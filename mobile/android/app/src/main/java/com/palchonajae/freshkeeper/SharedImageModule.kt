package com.palchonajae.freshkeeper

import android.app.Activity
import android.content.Intent
import android.graphics.BitmapFactory
import android.net.Uri
import com.facebook.react.bridge.Arguments
import com.facebook.react.ReactApplication
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

class SharedImageModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  companion object {
    private const val SHARED_IMAGE_EVENT = "FreshKeeperSharedImageIntent"
    private var pendingShareIntent: Intent? = null

    fun notifySharedImageIntent(activity: Activity, intent: Intent?) {
      if (extractImageUri(intent) == null) return
      pendingShareIntent = Intent(intent)
      val reactContext = (activity.application as? ReactApplication)
        ?.reactNativeHost
        ?.reactInstanceManager
        ?.currentReactContext
      reactContext
        ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        ?.emit(SHARED_IMAGE_EVENT, null)
    }

    private fun extractImageUri(intent: Intent?): Uri? {
      if (intent?.action != Intent.ACTION_SEND) return null
      val type = intent.type ?: return null
      if (!type.startsWith("image/")) return null
      return intent.getParcelableExtra(Intent.EXTRA_STREAM)
    }
  }

  override fun getName(): String = "SharedImage"

  @ReactMethod
  fun consumeInitialImage(promise: Promise) {
    try {
      val activity = getCurrentActivity()
      val intent = pendingShareIntent ?: activity?.intent
      val uri = extractImageUri(intent)
      if (activity == null || uri == null) {
        promise.resolve(null)
        return
      }

      val copiedFile = copySharedImage(activity, uri)
      val imageOptions = BitmapFactory.Options().apply {
        inJustDecodeBounds = true
      }
      BitmapFactory.decodeFile(copiedFile.absolutePath, imageOptions)
      val imageAsset = Arguments.createMap().apply {
        putString("uri", Uri.fromFile(copiedFile).toString())
        putString("fileName", copiedFile.name)
        putString("mimeType", activity.contentResolver.getType(uri) ?: "image/jpeg")
        if (imageOptions.outWidth > 0 && imageOptions.outHeight > 0) {
          putInt("width", imageOptions.outWidth)
          putInt("height", imageOptions.outHeight)
        }
      }
      pendingShareIntent = null
      activity.intent = Intent(activity.intent).apply {
        action = Intent.ACTION_MAIN
        type = null
        removeExtra(Intent.EXTRA_STREAM)
      }
      promise.resolve(imageAsset)
    } catch (error: Exception) {
      promise.reject("shared_image_failed", error.message, error)
    }
  }

  private fun copySharedImage(activity: Activity, uri: Uri): File {
    val directory = File(activity.cacheDir, "shared-receipts")
    if (!directory.exists()) directory.mkdirs()
    val extension = extensionForUri(uri)
    val target = File(directory, "shared-receipt-${System.currentTimeMillis()}.$extension")

    activity.contentResolver.openInputStream(uri).use { input ->
      requireNotNull(input) { "Cannot open shared image." }
      target.outputStream().use { output -> input.copyTo(output) }
    }

    return target
  }

  private fun extensionForUri(uri: Uri): String {
    val type = reactContext.contentResolver.getType(uri) ?: return "jpg"
    return when {
      type.contains("png") -> "png"
      type.contains("webp") -> "webp"
      else -> "jpg"
    }
  }
}
