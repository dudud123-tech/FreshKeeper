package com.wooyoung43.freshkeeper

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import org.opencv.android.OpenCVLoader
import org.opencv.android.Utils
import org.opencv.core.CvType
import org.opencv.core.Mat
import org.opencv.core.MatOfPoint
import org.opencv.core.MatOfPoint2f
import org.opencv.core.Point
import org.opencv.core.Rect
import org.opencv.core.Size
import org.opencv.imgproc.Imgproc
import java.io.File
import java.io.FileOutputStream
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

class ReceiptImageNormalizerModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "ReceiptImageNormalizer"

  @ReactMethod
  fun normalizeReceiptImage(imageUri: String, promise: Promise) {
    try {
      if (!OpenCVLoader.initDebug()) {
        promise.resolve(result(false, imageUri, 0, 0, "opencv_unavailable"))
        return
      }

      val bitmap = loadBitmap(imageUri)
      if (bitmap == null) {
        promise.resolve(result(false, imageUri, 0, 0, "image_unreadable"))
        return
      }

      val source = Mat()
      Utils.bitmapToMat(bitmap, source)
      val receiptContour = findReceiptContour(source)
      if (receiptContour == null) {
        source.release()
        promise.resolve(result(false, imageUri, bitmap.width, bitmap.height, "receipt_not_found"))
        return
      }

      val corners = orderCorners(receiptContour.toArray().toList())
      val targetSize = targetSizeForCorners(corners, bitmap.width, bitmap.height)
      if (targetSize.width < 320.0 || targetSize.height < 480.0) {
        source.release()
        promise.resolve(result(false, imageUri, bitmap.width, bitmap.height, "receipt_too_small"))
        return
      }

      val destination = Mat(targetSize, CvType.CV_8UC4)
      val from = MatOfPoint2f(*corners.toTypedArray())
      val to = MatOfPoint2f(
        Point(0.0, 0.0),
        Point(targetSize.width - 1.0, 0.0),
        Point(targetSize.width - 1.0, targetSize.height - 1.0),
        Point(0.0, targetSize.height - 1.0)
      )
      val transform = Imgproc.getPerspectiveTransform(from, to)
      Imgproc.warpPerspective(source, destination, transform, targetSize, Imgproc.INTER_CUBIC)

      val normalizedBitmap = Bitmap.createBitmap(destination.cols(), destination.rows(), Bitmap.Config.ARGB_8888)
      Utils.matToBitmap(destination, normalizedBitmap)
      val normalizedUri = saveNormalizedReceipt(normalizedBitmap)

      source.release()
      destination.release()
      transform.release()
      from.release()
      to.release()
      receiptContour.release()
      normalizedBitmap.recycle()

      if (normalizedUri.isBlank()) {
        promise.resolve(result(false, imageUri, bitmap.width, bitmap.height, "save_failed"))
        return
      }

      promise.resolve(result(true, normalizedUri, targetSize.width.roundToInt(), targetSize.height.roundToInt(), "normalized"))
    } catch (error: Exception) {
      promise.reject("receipt_normalize_failed", error.message, error)
    }
  }

  @ReactMethod
  fun detectTextLineBoxes(imageUri: String, promise: Promise) {
    try {
      if (!OpenCVLoader.initDebug()) {
        promise.resolve(Arguments.createArray())
        return
      }

      val bitmap = loadBitmap(imageUri)
      if (bitmap == null) {
        promise.resolve(Arguments.createArray())
        return
      }

      val source = Mat()
      Utils.bitmapToMat(bitmap, source)
      val boxes = detectTextLines(source)
      source.release()

      val result = Arguments.createArray()
      boxes.forEachIndexed { index, rect ->
        val box = Arguments.createMap()
        box.putString("id", "opencv-text-line-$index")
        box.putDouble("x", rect.x.toDouble())
        box.putDouble("y", rect.y.toDouble())
        box.putDouble("width", rect.width.toDouble())
        box.putDouble("height", rect.height.toDouble())
        result.pushMap(box)
      }
      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("text_line_detect_failed", error.message, error)
    }
  }

  @ReactMethod
  fun calibrateOcrLineBoxes(imageUri: String, lines: ReadableArray, promise: Promise) {
    try {
      if (!OpenCVLoader.initDebug()) {
        promise.resolve(ocrCalibrationResult(Arguments.createArray(), 0.0, 0.0, 0, "opencv_unavailable"))
        return
      }

      val bitmap = loadBitmap(imageUri)
      if (bitmap == null) {
        promise.resolve(ocrCalibrationResult(Arguments.createArray(), 0.0, 0.0, 0, "image_unreadable"))
        return
      }

      val source = Mat()
      val gray = Mat()
      Utils.bitmapToMat(bitmap, source)
      Imgproc.cvtColor(source, gray, Imgproc.COLOR_RGBA2GRAY)

      val samples = mutableListOf<CalibrationSample>()
      val originalBoxes = mutableListOf<Pair<String, Rect>>()

      for (index in 0 until lines.size()) {
        val line = lines.getMap(index) ?: continue
        val id = line.getString("id") ?: "ocr-$index"
        val box = line.getMap("box") ?: continue
        val rect = rectFromReadableMap(box, source.width(), source.height()) ?: continue
        originalBoxes.add(id to rect)

        val detectedRect = detectTextPixelsNearBox(gray, rect)
        if (detectedRect != null) {
          val deltaX = centerX(detectedRect) - centerX(rect)
          val deltaY = centerY(detectedRect) - centerY(rect)
          if (kotlin.math.abs(deltaX) <= source.width() * 0.08 && kotlin.math.abs(deltaY) <= source.height() * 0.08) {
            samples.add(CalibrationSample(deltaX, deltaY))
          }
        }
      }

      val sampleCount = samples.size
      if (sampleCount < max(4, originalBoxes.size / 5)) {
        source.release()
        gray.release()
        promise.resolve(ocrCalibrationResult(Arguments.createArray(), 0.0, 0.0, sampleCount, "not_enough_samples"))
        return
      }

      val offsetX = medianDouble(samples.map { it.deltaX })
      val offsetY = medianDouble(samples.map { it.deltaY })
      val calibratedBoxes = Arguments.createArray()
      originalBoxes.forEach { (id, rect) ->
        val calibrated = Arguments.createMap()
        val box = Arguments.createMap()
        val x = clamp((rect.x + offsetX).roundToInt(), 0, max(0, source.width() - rect.width))
        val y = clamp((rect.y + offsetY).roundToInt(), 0, max(0, source.height() - rect.height))
        box.putDouble("x", x.toDouble())
        box.putDouble("y", y.toDouble())
        box.putDouble("width", rect.width.toDouble())
        box.putDouble("height", rect.height.toDouble())
        calibrated.putString("id", id)
        calibrated.putMap("box", box)
        calibratedBoxes.pushMap(calibrated)
      }

      source.release()
      gray.release()
      promise.resolve(ocrCalibrationResult(calibratedBoxes, offsetX, offsetY, sampleCount, "calibrated"))
    } catch (error: Exception) {
      promise.reject("ocr_box_calibrate_failed", error.message, error)
    }
  }

  private fun loadBitmap(imageUri: String): Bitmap? {
    val uri = Uri.parse(imageUri)
    return reactContext.contentResolver.openInputStream(uri).use { input ->
      if (input == null) null else BitmapFactory.decodeStream(input)
    }
  }

  private fun findReceiptContour(source: Mat): MatOfPoint2f? {
    val gray = Mat()
    val blurred = Mat()
    val edges = Mat()
    Imgproc.cvtColor(source, gray, Imgproc.COLOR_RGBA2GRAY)
    Imgproc.GaussianBlur(gray, blurred, Size(5.0, 5.0), 0.0)
    Imgproc.Canny(blurred, edges, 45.0, 140.0)

    val kernel = Imgproc.getStructuringElement(Imgproc.MORPH_RECT, Size(5.0, 5.0))
    Imgproc.dilate(edges, edges, kernel)
    Imgproc.erode(edges, edges, kernel)

    val contours = mutableListOf<MatOfPoint>()
    Imgproc.findContours(edges, contours, Mat(), Imgproc.RETR_EXTERNAL, Imgproc.CHAIN_APPROX_SIMPLE)
    val imageArea = source.width().toDouble() * source.height().toDouble()
    var best: MatOfPoint2f? = null
    var bestScore = 0.0

    for (contour in contours) {
      val area = Imgproc.contourArea(contour)
      if (area < imageArea * 0.12) {
        contour.release()
        continue
      }
      val curve = MatOfPoint2f(*contour.toArray())
      val perimeter = Imgproc.arcLength(curve, true)
      val approx = MatOfPoint2f()
      Imgproc.approxPolyDP(curve, approx, perimeter * 0.025, true)
      val points = approx.toArray()
      if (points.size == 4 && Imgproc.isContourConvex(MatOfPoint(*points))) {
        val rect = Imgproc.boundingRect(MatOfPoint(*points))
        val aspect = max(rect.width, rect.height).toDouble() / max(1, min(rect.width, rect.height)).toDouble()
        val score = area * (if (aspect in 1.4..5.5) 1.0 else 0.55)
        if (score > bestScore) {
          best?.release()
          best = approx
          bestScore = score
        } else {
          approx.release()
        }
      } else {
        approx.release()
      }
      curve.release()
      contour.release()
    }

    gray.release()
    blurred.release()
    edges.release()
    kernel.release()
    return best
  }

  private fun detectTextLines(source: Mat): List<Rect> {
    val gray = Mat()
    val binary = Mat()
    val closed = Mat()
    Imgproc.cvtColor(source, gray, Imgproc.COLOR_RGBA2GRAY)
    Imgproc.adaptiveThreshold(
      gray,
      binary,
      255.0,
      Imgproc.ADAPTIVE_THRESH_GAUSSIAN_C,
      Imgproc.THRESH_BINARY_INV,
      31,
      15.0
    )

    val closeKernel = Imgproc.getStructuringElement(
      Imgproc.MORPH_RECT,
      Size(max(12, source.width() / 38).toDouble(), max(2, source.height() / 900).toDouble())
    )
    Imgproc.morphologyEx(binary, closed, Imgproc.MORPH_CLOSE, closeKernel)

    val dilateKernel = Imgproc.getStructuringElement(
      Imgproc.MORPH_RECT,
      Size(max(8, source.width() / 90).toDouble(), max(2, source.height() / 520).toDouble())
    )
    Imgproc.dilate(closed, closed, dilateKernel)

    val contours = mutableListOf<MatOfPoint>()
    Imgproc.findContours(closed, contours, Mat(), Imgproc.RETR_EXTERNAL, Imgproc.CHAIN_APPROX_SIMPLE)
    val candidates = mutableListOf<Rect>()
    val minWidth = source.width() * 0.035
    val maxWidth = source.width() * 0.94
    val minHeight = max(5, source.height() / 260)
    val maxHeight = max(18, source.height() / 22)

    for (contour in contours) {
      val rect = Imgproc.boundingRect(contour)
      val area = rect.width.toDouble() * rect.height.toDouble()
      val imageArea = source.width().toDouble() * source.height().toDouble()
      val aspect = rect.width.toDouble() / max(1, rect.height).toDouble()
      val isLikelyTextLine =
        rect.width >= minWidth &&
          rect.width <= maxWidth &&
          rect.height >= minHeight &&
          rect.height <= maxHeight &&
          aspect >= 1.8 &&
          area < imageArea * 0.12
      if (isLikelyTextLine) candidates.add(rect)
      contour.release()
    }

    gray.release()
    binary.release()
    closed.release()
    closeKernel.release()
    dilateKernel.release()

    return mergeTextLineRects(candidates, source.width(), source.height())
  }

  private fun mergeTextLineRects(rects: List<Rect>, imageWidth: Int, imageHeight: Int): List<Rect> {
    if (rects.isEmpty()) return emptyList()
    val sorted = rects.sortedWith(compareBy<Rect> { it.y + it.height / 2 }.thenBy { it.x })
    val merged = mutableListOf<Rect>()
    val yTolerance = max(6, imageHeight / 170)

    for (rect in sorted) {
      val last = merged.lastOrNull()
      if (last == null) {
        merged.add(rect)
        continue
      }

      val lastCenter = last.y + last.height / 2
      val rectCenter = rect.y + rect.height / 2
      val verticalOverlap = min(last.y + last.height, rect.y + rect.height) - max(last.y, rect.y)
      val shouldMerge = kotlin.math.abs(lastCenter - rectCenter) <= yTolerance || verticalOverlap > min(last.height, rect.height) * 0.35
      if (shouldMerge) {
        val left = min(last.x, rect.x)
        val top = min(last.y, rect.y)
        val right = max(last.x + last.width, rect.x + rect.width)
        val bottom = max(last.y + last.height, rect.y + rect.height)
        merged[merged.lastIndex] = Rect(left, top, right - left, bottom - top)
      } else {
        merged.add(rect)
      }
    }

    return merged
      .map { rect ->
        val padX = max(2, imageWidth / 180)
        val padY = max(1, imageHeight / 600)
        val left = max(0, rect.x - padX)
        val top = max(0, rect.y - padY)
        val right = min(imageWidth, rect.x + rect.width + padX)
        val bottom = min(imageHeight, rect.y + rect.height + padY)
        Rect(left, top, right - left, bottom - top)
      }
      .filter { it.width >= imageWidth * 0.035 && it.height >= 4 }
      .sortedBy { it.y }
  }

  private fun detectTextPixelsNearBox(gray: Mat, original: Rect): Rect? {
    val padX = max(12, (original.width * 0.38).roundToInt())
    val padY = max(8, (original.height * 1.55).roundToInt())
    val left = clamp(original.x - padX, 0, gray.width() - 1)
    val top = clamp(original.y - padY, 0, gray.height() - 1)
    val right = clamp(original.x + original.width + padX, left + 1, gray.width())
    val bottom = clamp(original.y + original.height + padY, top + 1, gray.height())
    val roiRect = Rect(left, top, right - left, bottom - top)
    val roi = Mat(gray, roiRect)
    val binary = Mat()
    Imgproc.threshold(roi, binary, 0.0, 255.0, Imgproc.THRESH_BINARY_INV + Imgproc.THRESH_OTSU)

    val kernel = Imgproc.getStructuringElement(Imgproc.MORPH_RECT, Size(2.0, 2.0))
    Imgproc.morphologyEx(binary, binary, Imgproc.MORPH_OPEN, kernel)

    val contours = mutableListOf<MatOfPoint>()
    Imgproc.findContours(binary, contours, Mat(), Imgproc.RETR_EXTERNAL, Imgproc.CHAIN_APPROX_SIMPLE)
    var found: Rect? = null
    for (contour in contours) {
      val rect = Imgproc.boundingRect(contour)
      val area = rect.width * rect.height
      val isSeparator = rect.width > roiRect.width * 0.82 && rect.height <= max(2, original.height / 5)
      val isNoise = rect.width < 2 || rect.height < 2 || area < 5 || isSeparator
      if (!isNoise) {
        found = if (found == null) rect else union(found!!, rect)
      }
      contour.release()
    }

    roi.release()
    binary.release()
    kernel.release()

    val textRect = found ?: return null
    val minTextWidth = max(4, (original.width * 0.12).roundToInt())
    val minTextHeight = max(3, (original.height * 0.22).roundToInt())
    if (textRect.width < minTextWidth || textRect.height < minTextHeight) {
      return null
    }
    return Rect(left + textRect.x, top + textRect.y, textRect.width, textRect.height)
  }

  private fun rectFromReadableMap(box: ReadableMap, imageWidth: Int, imageHeight: Int): Rect? {
    val x = readDouble(box, "x")
    val y = readDouble(box, "y")
    val width = readDouble(box, "width")
    val height = readDouble(box, "height")
    if (!x.isFinite() || !y.isFinite() || !width.isFinite() || !height.isFinite() || width <= 0 || height <= 0) {
      return null
    }
    val left = clamp(x.roundToInt(), 0, max(0, imageWidth - 1))
    val top = clamp(y.roundToInt(), 0, max(0, imageHeight - 1))
    val right = clamp((x + width).roundToInt(), left + 1, imageWidth)
    val bottom = clamp((y + height).roundToInt(), top + 1, imageHeight)
    return Rect(left, top, right - left, bottom - top)
  }

  private fun orderCorners(points: List<Point>): List<Point> {
    val topLeft = points.minBy { it.x + it.y }
    val bottomRight = points.maxBy { it.x + it.y }
    val topRight = points.minBy { it.y - it.x }
    val bottomLeft = points.maxBy { it.y - it.x }
    return listOf(topLeft, topRight, bottomRight, bottomLeft)
  }

  private fun targetSizeForCorners(points: List<Point>, originalWidth: Int, originalHeight: Int): Size {
    val topWidth = distance(points[0], points[1])
    val bottomWidth = distance(points[3], points[2])
    val leftHeight = distance(points[0], points[3])
    val rightHeight = distance(points[1], points[2])
    val width = clamp(max(topWidth, bottomWidth).roundToInt(), 480, originalWidth * 2)
    val height = clamp(max(leftHeight, rightHeight).roundToInt(), 640, originalHeight * 2)
    return Size(width.toDouble(), height.toDouble())
  }

  private fun saveNormalizedReceipt(bitmap: Bitmap): String {
    val directory = File(reactContext.cacheDir, "normalized-receipts")
    if (!directory.exists()) directory.mkdirs()
    val file = File(directory, "normalized-receipt-${System.currentTimeMillis()}.jpg")
    FileOutputStream(file).use { output ->
      bitmap.compress(Bitmap.CompressFormat.JPEG, 94, output)
    }
    return Uri.fromFile(file).toString()
  }

  private fun result(normalized: Boolean, imageUri: String, width: Int, height: Int, reason: String) =
    Arguments.createMap().apply {
      putBoolean("normalized", normalized)
      putString("imageUri", imageUri)
      putInt("width", width)
      putInt("height", height)
      putString("reason", reason)
    }

  private fun ocrCalibrationResult(boxes: com.facebook.react.bridge.WritableArray, offsetX: Double, offsetY: Double, sampleCount: Int, reason: String) =
    Arguments.createMap().apply {
      putArray("boxes", boxes)
      putDouble("offsetX", offsetX)
      putDouble("offsetY", offsetY)
      putInt("sampleCount", sampleCount)
      putString("reason", reason)
    }

  private data class CalibrationSample(val deltaX: Double, val deltaY: Double)

  private fun distance(a: Point, b: Point): Double = hypot(a.x - b.x, a.y - b.y)

  private fun centerX(rect: Rect): Double = rect.x + rect.width / 2.0

  private fun centerY(rect: Rect): Double = rect.y + rect.height / 2.0

  private fun union(a: Rect, b: Rect): Rect {
    val left = min(a.x, b.x)
    val top = min(a.y, b.y)
    val right = max(a.x + a.width, b.x + b.width)
    val bottom = max(a.y + a.height, b.y + b.height)
    return Rect(left, top, right - left, bottom - top)
  }

  private fun readDouble(map: ReadableMap, key: String): Double {
    return if (map.hasKey(key) && !map.isNull(key)) map.getDouble(key) else Double.NaN
  }

  private fun medianDouble(values: List<Double>): Double {
    if (values.isEmpty()) return 0.0
    val sorted = values.sorted()
    val middle = sorted.size / 2
    return if (sorted.size % 2 == 1) sorted[middle] else (sorted[middle - 1] + sorted[middle]) / 2.0
  }

  private fun clamp(value: Int, minValue: Int, maxValue: Int): Int {
    return max(minValue, min(maxValue, value))
  }
}
