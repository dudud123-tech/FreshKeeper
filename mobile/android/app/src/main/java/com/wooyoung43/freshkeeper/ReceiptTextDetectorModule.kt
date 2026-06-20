package com.wooyoung43.freshkeeper

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import org.opencv.android.OpenCVLoader
import org.opencv.core.CvType
import org.opencv.core.Mat
import org.opencv.core.MatOfPoint
import org.opencv.core.Rect
import org.opencv.imgproc.Imgproc
import org.tensorflow.lite.Interpreter
import java.io.ByteArrayOutputStream
import java.io.FileNotFoundException
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.max
import kotlin.math.min

class ReceiptTextDetectorModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private var interpreter: Interpreter? = null

  override fun getName(): String = "ReceiptTextDetector"

  @ReactMethod
  fun detectTextBoxes(imageUri: String, promise: Promise) {
    try {
      if (!OpenCVLoader.initDebug()) {
        promise.resolve(Arguments.createArray())
        return
      }

      val bitmap = loadBitmap(imageUri)
      val currentInterpreter = loadInterpreter()
      if (bitmap == null || currentInterpreter == null) {
        Log.d(TAG, "skip bitmap=${bitmap != null} interpreter=${currentInterpreter != null}")
        promise.resolve(Arguments.createArray())
        return
      }

      val inputShape = currentInterpreter.getInputTensor(0).shape()
      val inputInfo = inputInfo(inputShape)
      Log.d(TAG, "inputShape=${inputShape.joinToString()} input=${inputInfo.width}x${inputInfo.height} nchw=${inputInfo.nchw}")
      if (inputInfo.width <= 0 || inputInfo.height <= 0) {
        promise.resolve(Arguments.createArray())
        return
      }

      val resized = Bitmap.createScaledBitmap(bitmap, inputInfo.width, inputInfo.height, true)
      val input = bitmapToInputBuffer(resized, inputInfo)
      val outputShape = currentInterpreter.getOutputTensor(0).shape()
      val outputElementCount = outputShape.fold(1) { acc, value -> acc * max(1, value) }
      Log.d(TAG, "outputShape=${outputShape.joinToString()} outputElements=$outputElementCount")
      val outputBuffer = ByteBuffer
        .allocateDirect(4 * outputElementCount)
        .order(ByteOrder.nativeOrder())

      currentInterpreter.run(input, outputBuffer)
      outputBuffer.rewind()
      val output = FloatArray(outputElementCount)
      outputBuffer.asFloatBuffer().get(output)

      val boxes = probabilityMapToBoxes(
        values = output,
        outputShape = outputShape,
        originalWidth = bitmap.width,
        originalHeight = bitmap.height
      )
      Log.d(TAG, "boxes=${boxes.size} original=${bitmap.width}x${bitmap.height}")

      val result = Arguments.createArray()
      boxes.forEachIndexed { index, rect ->
        val box = Arguments.createMap()
        box.putString("id", "dbnet-text-line-$index")
        box.putDouble("x", rect.x.toDouble())
        box.putDouble("y", rect.y.toDouble())
        box.putDouble("width", rect.width.toDouble())
        box.putDouble("height", rect.height.toDouble())
        box.putDouble("score", 1.0)
        result.pushMap(box)
      }
      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("receipt_text_detect_failed", error.message, error)
    }
  }

  private fun loadInterpreter(): Interpreter? {
    interpreter?.let { return it }
    return try {
      val model = reactContext.assets.open(MODEL_ASSET_NAME).use { input ->
        val output = ByteArrayOutputStream()
        input.copyTo(output)
        output.toByteArray()
      }
      val buffer = ByteBuffer.allocateDirect(model.size).order(ByteOrder.nativeOrder())
      buffer.put(model)
      buffer.rewind()
      Interpreter(buffer, Interpreter.Options().setNumThreads(2)).also {
        interpreter = it
        Log.d(TAG, "model loaded bytes=${model.size}")
      }
    } catch (_: FileNotFoundException) {
      Log.d(TAG, "model not found: $MODEL_ASSET_NAME")
      null
    } catch (error: Exception) {
      Log.d(TAG, "model load failed: ${error.message}")
      null
    }
  }

  private fun loadBitmap(imageUri: String): Bitmap? {
    val uri = Uri.parse(imageUri)
    return reactContext.contentResolver.openInputStream(uri).use { input ->
      if (input == null) null else BitmapFactory.decodeStream(input)
    }
  }

  private fun inputInfo(shape: IntArray): InputInfo {
    if (shape.size < 4) return InputInfo(0, 0, false)
    val isNchw = shape[1] == 3
    return if (isNchw) {
      InputInfo(width = shape[3], height = shape[2], nchw = true)
    } else {
      InputInfo(width = shape[2], height = shape[1], nchw = false)
    }
  }

  private fun bitmapToInputBuffer(bitmap: Bitmap, inputInfo: InputInfo): ByteBuffer {
    val buffer = ByteBuffer
      .allocateDirect(4 * inputInfo.width * inputInfo.height * 3)
      .order(ByteOrder.nativeOrder())
    val pixels = IntArray(inputInfo.width * inputInfo.height)
    bitmap.getPixels(pixels, 0, inputInfo.width, 0, 0, inputInfo.width, inputInfo.height)

    if (inputInfo.nchw) {
      for (channel in 0 until 3) {
        for (pixel in pixels) {
          buffer.putFloat(channelValue(pixel, channel))
        }
      }
    } else {
      for (pixel in pixels) {
        buffer.putFloat(channelValue(pixel, 0))
        buffer.putFloat(channelValue(pixel, 1))
        buffer.putFloat(channelValue(pixel, 2))
      }
    }
    buffer.rewind()
    return buffer
  }

  private fun channelValue(pixel: Int, channel: Int): Float {
    val value = when (channel) {
      0 -> (pixel shr 16) and 0xff
      1 -> (pixel shr 8) and 0xff
      else -> pixel and 0xff
    }
    return value / 255f
  }

  private fun probabilityMapToBoxes(
    values: FloatArray,
    outputShape: IntArray,
    originalWidth: Int,
    originalHeight: Int
  ): List<Rect> {
    val mapInfo = probabilityMapInfo(outputShape)
    val height = mapInfo.height
    val width = mapInfo.width
    if (width <= 0 || height <= 0 || values.isEmpty()) return emptyList()

    val mask = Mat(height, width, CvType.CV_8UC1)
    val maskBytes = ByteArray(width * height)
    for (index in maskBytes.indices) {
      val value = values.getOrNull(mapInfo.offset + index * mapInfo.stride) ?: 0f
      maskBytes[index] = if (value >= DBNET_THRESHOLD) 255.toByte() else 0.toByte()
    }
    mask.put(0, 0, maskBytes)

    val kernel = Imgproc.getStructuringElement(
      Imgproc.MORPH_RECT,
      org.opencv.core.Size(max(3, width / 120).toDouble(), max(2, height / 220).toDouble())
    )
    Imgproc.morphologyEx(mask, mask, Imgproc.MORPH_CLOSE, kernel)

    val contours = mutableListOf<MatOfPoint>()
    Imgproc.findContours(mask, contours, Mat(), Imgproc.RETR_EXTERNAL, Imgproc.CHAIN_APPROX_SIMPLE)
    val boxes = contours
      .map { Imgproc.boundingRect(it) }
      .filter { rect ->
        val mappedWidth = rect.width.toDouble() / width.toDouble() * originalWidth.toDouble()
        val mappedHeight = rect.height.toDouble() / height.toDouble() * originalHeight.toDouble()
        mappedWidth >= 8.0 && mappedHeight >= 5.0 && mappedWidth <= originalWidth * 0.98 && mappedHeight <= originalHeight * 0.25
      }
      .map { rect ->
        Rect(
          ((rect.x.toDouble() / width.toDouble()) * originalWidth).toInt(),
          ((rect.y.toDouble() / height.toDouble()) * originalHeight).toInt(),
          max(1, ((rect.width.toDouble() / width.toDouble()) * originalWidth).toInt()),
          max(1, ((rect.height.toDouble() / height.toDouble()) * originalHeight).toInt())
        )
      }
      .let { mergeNearbyBoxes(it) }
      .sortedWith(compareBy<Rect> { it.y }.thenBy { it.x })

    mask.release()
    kernel.release()
    contours.forEach { it.release() }
    return boxes
  }

  private fun mergeNearbyBoxes(boxes: List<Rect>): List<Rect> {
    val merged = mutableListOf<Rect>()
    for (box in boxes.sortedWith(compareBy<Rect> { it.y }.thenBy { it.x })) {
      val target = merged.firstOrNull { shouldMerge(it, box) }
      if (target == null) {
        merged.add(Rect(box.x, box.y, box.width, box.height))
      } else {
        val x1 = min(target.x, box.x)
        val y1 = min(target.y, box.y)
        val x2 = max(target.x + target.width, box.x + box.width)
        val y2 = max(target.y + target.height, box.y + box.height)
        target.x = x1
        target.y = y1
        target.width = x2 - x1
        target.height = y2 - y1
      }
    }
    return merged
  }

  private fun shouldMerge(a: Rect, b: Rect): Boolean {
    val centerA = a.y + a.height / 2.0
    val centerB = b.y + b.height / 2.0
    val sameLine = kotlin.math.abs(centerA - centerB) <= max(a.height, b.height) * 0.75
    val near = b.x <= a.x + a.width + 16 && a.x <= b.x + b.width + 16
    return sameLine && near
  }

  private fun probabilityMapInfo(shape: IntArray): ProbabilityMapInfo {
    if (shape.size == 4) {
      val isNchw = shape[1] <= 4 && shape[2] > 4 && shape[3] > 4
      if (isNchw) {
        return ProbabilityMapInfo(width = shape[3], height = shape[2], stride = 1, offset = 0)
      }

      val isNhwc = shape[3] <= 4 && shape[1] > 4 && shape[2] > 4
      if (isNhwc) {
        return ProbabilityMapInfo(width = shape[2], height = shape[1], stride = shape[3], offset = 0)
      }
    }

    if (shape.size == 3) {
      return ProbabilityMapInfo(width = shape[2], height = shape[1], stride = 1, offset = 0)
    }

    if (shape.size == 2) {
      return ProbabilityMapInfo(width = shape[1], height = shape[0], stride = 1, offset = 0)
    }

    return ProbabilityMapInfo(width = 0, height = 0, stride = 1, offset = 0)
  }

  private data class InputInfo(val width: Int, val height: Int, val nchw: Boolean)
  private data class ProbabilityMapInfo(val width: Int, val height: Int, val stride: Int, val offset: Int)

  companion object {
    private const val TAG = "FreshKeeperDBNet"
    private const val MODEL_ASSET_NAME = "dbnet_receipt.tflite"
    private const val DBNET_THRESHOLD = 0.35f
  }
}
