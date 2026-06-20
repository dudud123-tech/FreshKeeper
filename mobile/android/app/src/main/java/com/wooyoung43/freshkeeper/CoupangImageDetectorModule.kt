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
import org.opencv.core.Core
import org.opencv.core.Mat
import org.opencv.core.MatOfDouble
import org.opencv.core.MatOfPoint
import org.opencv.core.Rect
import org.opencv.core.Scalar
import org.opencv.imgproc.Imgproc
import java.io.File
import java.io.FileOutputStream
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

class CoupangImageDetectorModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "CoupangImageDetector"

  @ReactMethod
  fun detectProductImages(
    imageUri: String,
    lines: ReadableArray,
    coordinateSize: ReadableMap,
    draftNames: ReadableArray,
    promise: Promise
  ) {
    try {
      if (!OpenCVLoader.initDebug()) {
        promise.reject("opencv_unavailable", "OpenCV could not be initialized.")
        return
      }

      val bitmap = loadBitmap(imageUri)
      if (bitmap == null) {
        promise.resolve(emptyResult())
        return
      }

      val coordinateWidth = coordinateSize.number("width", bitmap.width.toDouble())
      val coordinateHeight = coordinateSize.number("height", bitmap.height.toDouble())
      if (coordinateWidth <= 0.0 || coordinateHeight <= 0.0) {
        promise.resolve(emptyResult())
        return
      }

      val normalizedLines = readLines(lines)
      val mat = Mat()
      Utils.bitmapToMat(bitmap, mat)

      val imageMap = Arguments.createMap()
      val cropBoxes = Arguments.createArray()
      val selectedLineIds = Arguments.createArray()
      val detectedDraftNames = Arguments.createArray()
      val usedRects = mutableListOf<Rect>()
      val thumbnailRects = detectThumbnailRects(
        mat = mat,
        bitmapWidth = bitmap.width,
        bitmapHeight = bitmap.height
      )

      for ((index, cropRect) in thumbnailRects.withIndex()) {
        val line = findProductLineForThumbnail(
          lines = normalizedLines,
          rect = cropRect,
          bitmapWidth = bitmap.width,
          bitmapHeight = bitmap.height,
          coordinateWidth = coordinateWidth,
          coordinateHeight = coordinateHeight
        ) ?: continue
        val draftName = matchDraftName(draftNames, line.text) ?: cleanupProductName(line.text)
        if (draftName.isBlank()) continue
        if (usedRects.any { intersectionRatio(it, cropRect) > 0.45 }) continue

        usedRects.add(cropRect)
        val croppedUri = saveCrop(bitmap, cropRect)
        if (croppedUri.isNotBlank()) imageMap.putString(draftName, croppedUri)
        selectedLineIds.pushString(line.id)
        detectedDraftNames.pushString(draftName)

        val cropBox = Arguments.createMap()
        cropBox.putString("id", "opencv-coupang-crop-$index-$draftName")
        cropBox.putString("draftName", draftName)
        cropBox.putString("lineId", line.id)
        cropBox.putString("imageUri", croppedUri)
        cropBox.putMap("box", rectToCoordinateBox(cropRect, bitmap.width, bitmap.height, coordinateWidth, coordinateHeight))
        cropBoxes.pushMap(cropBox)
      }

      mat.release()
      val result = Arguments.createMap()
      result.putMap("imageMap", imageMap)
      result.putArray("cropBoxes", cropBoxes)
      result.putArray("selectedLineIds", selectedLineIds)
      result.putArray("draftNames", detectedDraftNames)
      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("coupang_image_detection_failed", error.message, error)
    }
  }

  private fun loadBitmap(imageUri: String): Bitmap? {
    val uri = Uri.parse(imageUri)
    return reactContext.contentResolver.openInputStream(uri).use { input ->
      if (input == null) null else BitmapFactory.decodeStream(input)
    }
  }

  private fun readLines(lines: ReadableArray): List<OcrLine> {
    val result = mutableListOf<OcrLine>()
    for (index in 0 until lines.size()) {
      val line = lines.getMap(index) ?: continue
      val text = line.getString("text") ?: continue
      val box = line.getMap("box") ?: continue
      result.add(
        OcrLine(
          id = line.getString("id") ?: "native-ocr-$index",
          text = text,
          x = box.number("x", box.number("left", Double.NaN)),
          y = box.number("y", box.number("top", Double.NaN)),
          width = box.number("width", Double.NaN),
          height = box.number("height", Double.NaN)
        )
      )
    }
    return result.filter { it.isValid }
  }

  private fun detectThumbnailRects(
    mat: Mat,
    bitmapWidth: Int,
    bitmapHeight: Int
  ): List<Rect> {
    val expectedSide = clamp((bitmapWidth * 0.19).roundToInt(), 90, 280)
    val searchRect = Rect(0, 0, clamp((bitmapWidth * 0.42).roundToInt(), 1, bitmapWidth), bitmapHeight)

    val roi = Mat(mat, searchRect)
    val mask = imageLikeMask(roi)
    val contours = mutableListOf<MatOfPoint>()
    Imgproc.findContours(mask, contours, Mat(), Imgproc.RETR_EXTERNAL, Imgproc.CHAIN_APPROX_SIMPLE)

    val candidates = mutableListOf<Pair<Rect, Double>>()

    for (contour in contours) {
      val rect = Imgproc.boundingRect(contour)
      contour.release()
      if (rect.width < 32 || rect.height < 32) continue
      if (rect.area() < 1400.0) continue

      val absolute = Rect(rect.x + searchRect.x, rect.y + searchRect.y, rect.width, rect.height)
      val square = expandToSquare(absolute, expectedSide, bitmapWidth, bitmapHeight)
      if (square.x > bitmapWidth * 0.34) continue
      val ratio = square.width.toDouble() / max(1.0, square.height.toDouble())
      if (ratio < 0.72 || ratio > 1.38) continue
      if (!looksLikePhoto(mat, square)) continue

      val leftColumnBonus = if (square.x < bitmapWidth * 0.32) 40.0 else 0.0
      val sizeScore = 120.0 - abs(square.width - expectedSide)
      val score = rect.area() * 0.015 + sizeScore + leftColumnBonus
      candidates.add(square to score)
    }

    roi.release()
    mask.release()
    return candidates
      .sortedByDescending { it.second }
      .fold(mutableListOf<Rect>()) { accepted, candidate ->
        if (accepted.none { intersectionRatio(it, candidate.first) > 0.28 }) accepted.add(candidate.first)
        accepted
      }
      .sortedBy { it.y }
  }

  private fun findProductLineForThumbnail(
    lines: List<OcrLine>,
    rect: Rect,
    bitmapWidth: Int,
    bitmapHeight: Int,
    coordinateWidth: Double,
    coordinateHeight: Double
  ): OcrLine? {
    val scaleX = bitmapWidth / coordinateWidth
    val scaleY = bitmapHeight / coordinateHeight
    val rectTop = rect.y / scaleY
    val rectBottom = (rect.y + rect.height) / scaleY
    val rectRight = (rect.x + rect.width) / scaleX
    val yPadding = max(10.0, rect.height / scaleY * 0.18)
    return lines
      .filter { line ->
        val centerY = line.y + line.height / 2.0
        val lineKey = normalizeText(line.text)
        centerY >= rectTop - yPadding &&
          centerY <= rectBottom + yPadding &&
          line.x >= rectRight + coordinateWidth * 0.025 &&
          line.x < coordinateWidth * 0.88 &&
          isLikelyProductName(lineKey)
      }
      .minByOrNull { it.x }
  }

  private fun imageLikeMask(roi: Mat): Mat {
    val hsv = Mat()
    Imgproc.cvtColor(roi, hsv, Imgproc.COLOR_RGBA2RGB)
    Imgproc.cvtColor(hsv, hsv, Imgproc.COLOR_RGB2HSV)

    val saturated = Mat()
    Core.inRange(hsv, Scalar(0.0, 22.0, 35.0), Scalar(180.0, 255.0, 245.0), saturated)

    val gray = Mat()
    Imgproc.cvtColor(roi, gray, Imgproc.COLOR_RGBA2GRAY)
    val notWhite = Mat()
    Imgproc.threshold(gray, notWhite, 238.0, 255.0, Imgproc.THRESH_BINARY_INV)

    val mask = Mat()
    Core.bitwise_or(saturated, notWhite, mask)
    val kernel = Imgproc.getStructuringElement(Imgproc.MORPH_RECT, org.opencv.core.Size(5.0, 5.0))
    Imgproc.morphologyEx(mask, mask, Imgproc.MORPH_CLOSE, kernel)
    Imgproc.morphologyEx(mask, mask, Imgproc.MORPH_OPEN, kernel)

    hsv.release()
    saturated.release()
    gray.release()
    notWhite.release()
    kernel.release()
    return mask
  }

  private fun looksLikePhoto(mat: Mat, rect: Rect): Boolean {
    val roi = Mat(mat, rect)
    val gray = Mat()
    Imgproc.cvtColor(roi, gray, Imgproc.COLOR_RGBA2GRAY)
    val mean = MatOfDouble()
    val std = MatOfDouble()
    Core.meanStdDev(gray, mean, std)
    val stddev = std.toArray().firstOrNull() ?: 0.0

    val edges = Mat()
    Imgproc.Canny(gray, edges, 50.0, 140.0)
    val edgeRatio = Core.countNonZero(edges).toDouble() / max(1.0, rect.area())

    roi.release()
    gray.release()
    mean.release()
    std.release()
    edges.release()
    return stddev > 18.0 && edgeRatio > 0.015
  }

  private fun expandToSquare(rect: Rect, expectedSide: Int, bitmapWidth: Int, bitmapHeight: Int): Rect {
    val side = clamp(max(max(rect.width, rect.height), (expectedSide * 0.78).roundToInt()), 72, expectedSide + 60)
    val centerX = rect.x + rect.width / 2
    val centerY = rect.y + rect.height / 2
    val x = clamp(centerX - side / 2, 0, max(0, bitmapWidth - side))
    val y = clamp(centerY - side / 2, 0, max(0, bitmapHeight - side))
    return Rect(x, y, min(side, bitmapWidth - x), min(side, bitmapHeight - y))
  }

  private fun saveCrop(bitmap: Bitmap, rect: Rect): String {
    val safeRect = Rect(
      clamp(rect.x, 0, bitmap.width - 1),
      clamp(rect.y, 0, bitmap.height - 1),
      clamp(rect.width, 1, bitmap.width - rect.x),
      clamp(rect.height, 1, bitmap.height - rect.y)
    )
    val crop = Bitmap.createBitmap(bitmap, safeRect.x, safeRect.y, safeRect.width, safeRect.height)
    val scaled = Bitmap.createScaledBitmap(crop, 320, 320, true)
    val directory = File(reactContext.cacheDir, "coupang-product-images")
    if (!directory.exists()) directory.mkdirs()
    val file = File(directory, "coupang-product-${System.currentTimeMillis()}-${safeRect.y}.jpg")
    FileOutputStream(file).use { output ->
      scaled.compress(Bitmap.CompressFormat.JPEG, 88, output)
    }
    if (scaled != crop) scaled.recycle()
    crop.recycle()
    return Uri.fromFile(file).toString()
  }

  private fun rectToCoordinateBox(rect: Rect, bitmapWidth: Int, bitmapHeight: Int, coordinateWidth: Double, coordinateHeight: Double): ReadableMap {
    val map = Arguments.createMap()
    val scaleX = coordinateWidth / bitmapWidth
    val scaleY = coordinateHeight / bitmapHeight
    map.putDouble("x", rect.x * scaleX)
    map.putDouble("y", rect.y * scaleY)
    map.putDouble("width", rect.width * scaleX)
    map.putDouble("height", rect.height * scaleY)
    return map
  }

  private fun intersectionRatio(a: Rect, b: Rect): Double {
    val x1 = max(a.x, b.x)
    val y1 = max(a.y, b.y)
    val x2 = min(a.x + a.width, b.x + b.width)
    val y2 = min(a.y + a.height, b.y + b.height)
    if (x2 <= x1 || y2 <= y1) return 0.0
    val intersection = (x2 - x1) * (y2 - y1)
    return intersection.toDouble() / min(a.area(), b.area())
  }

  private fun emptyResult(): ReadableMap {
    val result = Arguments.createMap()
    result.putMap("imageMap", Arguments.createMap())
    result.putArray("cropBoxes", Arguments.createArray())
    return result
  }

  private fun normalizeText(value: String): String {
    return value.replace(Regex("\\s+"), "")
      .replace(Regex("[^\\p{L}\\p{N}]"), "")
      .lowercase()
  }

  private fun cleanupProductName(value: String): String {
    return value.trim()
      .replace(Regex("\\s+"), " ")
      .replace(Regex("^[·ㆍ\\-\\s]+"), "")
      .take(90)
  }

  private fun matchDraftName(draftNames: ReadableArray, lineText: String): String? {
    val lineKey = normalizeText(lineText)
    if (lineKey.isBlank()) return null
    for (index in 0 until draftNames.size()) {
      val draftName = draftNames.getString(index) ?: continue
      val draftKey = normalizeText(draftName)
      if (draftKey.isBlank()) continue
      if (lineKey.contains(draftKey) || draftKey.contains(lineKey)) return draftName
    }
    return null
  }

  private fun isLikelyProductName(value: String): Boolean {
    if (value.length < 4) return false
    if (value.matches(Regex("^[0-9]+원?[0-9]*개?$"))) return false
    val blocked = listOf("배송주문관리", "바로구매", "장바구니", "주문내역", "검색", "배송완료", "로켓프레시")
    if (blocked.any { value.contains(it) }) return false
    return true
  }

  private fun clamp(value: Int, minValue: Int, maxValue: Int): Int {
    return max(minValue, min(maxValue, value))
  }

  private data class OcrLine(
    val id: String,
    val text: String,
    val x: Double,
    val y: Double,
    val width: Double,
    val height: Double
  ) {
    val isValid: Boolean
      get() = listOf(x, y, width, height).all { it.isFinite() } && width > 0.0 && height > 0.0
  }
}

private fun ReadableMap.number(name: String, fallback: Double): Double {
  return if (hasKey(name) && !isNull(name)) getDouble(name) else fallback
}
