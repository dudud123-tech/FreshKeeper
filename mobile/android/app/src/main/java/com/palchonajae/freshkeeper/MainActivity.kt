package com.palchonajae.freshkeeper

import android.content.Intent
import android.content.res.Configuration
import android.os.Build
import android.os.Bundle

import com.facebook.react.ReactApplication
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.uimanager.DisplayMetricsHolder

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  private var appliedFontScale = 1f

  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    setTheme(R.style.AppTheme);
    super.onCreate(null)
    appliedFontScale = resources.configuration.fontScale
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    SharedImageModule.notifySharedImageIntent(this, intent)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    val fontScaleChanged = appliedFontScale != newConfig.fontScale
    super.onConfigurationChanged(newConfig)
    DisplayMetricsHolder.initDisplayMetrics(this)

    if (fontScaleChanged) {
      reloadReactForFontScale(newConfig.fontScale)
      return
    }

    window.decorView.requestLayout()
  }

  override fun onResume() {
    super.onResume()

    // Some Samsung devices defer configuration delivery while the app is in the
    // background. Recheck the resource value when returning from Settings.
    if (appliedFontScale != resources.configuration.fontScale) {
      reloadReactForFontScale(resources.configuration.fontScale)
    }
  }

  private fun reloadReactForFontScale(fontScale: Float) {
    appliedFontScale = fontScale
    DisplayMetricsHolder.initDisplayMetrics(this)

    val host = (application as? ReactApplication)?.reactHost
    if (host != null) {
      host.reload("Android font scale changed")
    } else {
      // Old-architecture fallback. The current app normally uses ReactHost.
      recreate()
    }
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }
}
