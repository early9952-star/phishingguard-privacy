package com.voicetyping.app

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.webkit.JavascriptInterface
import android.widget.Toast

/**
 * JavaScript → Android 네이티브 기능 호출 인터페이스
 * voice.html에서 Android.xxx() 로 호출 가능
 */
class WebAppInterface(private val context: Context) {

    /**
     * 네이티브 공유 (카카오톡, 문자 등)
     * JS: Android.shareText("제목", "내용")
     */
    @JavascriptInterface
    fun shareText(title: String, text: String) {
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, title)
            putExtra(Intent.EXTRA_TEXT, text)
        }
        val chooser = Intent.createChooser(intent, "공유하기")
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(chooser)
    }

    /**
     * 외부 브라우저로 URL 열기
     * JS: Android.openUrl("https://...")
     */
    @JavascriptInterface
    fun openUrl(url: String) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        } catch (e: Exception) {
            Toast.makeText(context, "링크를 열 수 없습니다", Toast.LENGTH_SHORT).show()
        }
    }

    /**
     * 토스트 메시지 표시
     * JS: Android.showToast("메시지")
     */
    @JavascriptInterface
    fun showToast(message: String) {
        Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
    }

    /**
     * 앱인지 웹인지 확인
     * JS: if (typeof Android !== 'undefined') { ... }
     */
    @JavascriptInterface
    fun isApp(): Boolean = true

    /**
     * 앱 버전
     */
    @JavascriptInterface
    fun getAppVersion(): String {
        return try {
            val pInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            pInfo.versionName ?: "1.0.0"
        } catch (e: Exception) {
            "1.0.0"
        }
    }
}
