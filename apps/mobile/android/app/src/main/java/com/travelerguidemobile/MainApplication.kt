package com.travelerguidemobile

import android.app.Application
import android.os.Build
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    if (BuildConfig.DEBUG) {
      // Physical phones need the PC Wi-Fi IP after USB is unplugged. adb reverse
      // to 127.0.0.1 only works while the cable is attached.
      val metroHost =
        if (isEmulator()) {
          "10.0.2.2:8081"
        } else {
          val lan = BuildConfig.DEV_MACHINE_HOST
          if (lan.isNullOrBlank() || lan == "127.0.0.1") "127.0.0.1:8081" else "$lan:8081"
        }
      getSharedPreferences("${packageName}_preferences", MODE_PRIVATE)
        .edit()
        .putString("debug_http_host", metroHost)
        .apply()
    }
    loadReactNative(this)
  }

  private fun isEmulator(): Boolean {
    val fingerprint = Build.FINGERPRINT.lowercase()
    val model = Build.MODEL.lowercase()
    val product = Build.PRODUCT.lowercase()
    return fingerprint.contains("generic") ||
      fingerprint.contains("emulator") ||
      model.contains("emulator") ||
      model.contains("android sdk") ||
      product.contains("sdk") ||
      product.contains("emulator")
  }
}
