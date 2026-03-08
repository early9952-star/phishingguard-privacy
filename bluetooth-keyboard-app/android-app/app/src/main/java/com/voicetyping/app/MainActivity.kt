package com.voicetyping.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.webkit.*
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    companion object {
        private const val PERMISSION_REQUEST_CODE = 100
        private val REQUIRED_PERMISSIONS = arrayOf(
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.CAMERA
        )
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 전체화면 WebView
        webView = WebView(this).apply {
            setBackgroundColor(0xFF0F0F1A.toInt())
        }
        setContentView(webView)

        // 권한 요청
        requestPermissionsIfNeeded()

        // WebView 설정
        setupWebView()

        // voice.html 로드 (assets에서)
        webView.loadUrl("file:///android_asset/voice.html")
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true                // localStorage 사용
            mediaPlaybackRequiresUserGesture = false // 음성인식 자동 시작
            allowFileAccess = true
            allowContentAccess = true
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            cacheMode = WebSettings.LOAD_DEFAULT

            // WebSocket 연결을 위해
            javaScriptCanOpenWindowsAutomatically = true
        }

        // JavaScript 인터페이스 (네이티브 기능 호출용)
        webView.addJavascriptInterface(WebAppInterface(this), "Android")

        // WebViewClient: 쿠팡 링크는 외부 브라우저로
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val url = request?.url?.toString() ?: return false
                return handleUrl(url)
            }

            @Deprecated("For older API levels")
            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                return url?.let { handleUrl(it) } ?: false
            }
        }

        // WebChromeClient: 카메라/마이크 권한 처리
        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest?) {
                request?.let {
                    runOnUiThread {
                        it.grant(it.resources)
                    }
                }
            }
        }
    }

    /**
     * URL 처리: 쿠팡/외부 링크는 외부 브라우저로, 나머지는 WebView에서
     */
    private fun handleUrl(url: String): Boolean {
        return when {
            // 쿠팡 파트너스 링크 → 외부 브라우저 (쿠키 추적 필요)
            url.contains("coupang.com") -> {
                openExternalBrowser(url)
                true
            }
            // 카카오 공유 → 외부
            url.contains("story.kakao.com") || url.contains("kakao") -> {
                openExternalBrowser(url)
                true
            }
            // sms: 스킴 → 문자 앱
            url.startsWith("sms:") -> {
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                } catch (e: Exception) {
                    Toast.makeText(this, "문자 앱을 열 수 없습니다", Toast.LENGTH_SHORT).show()
                }
                true
            }
            // 일반 http/https 외부 링크 → 외부 브라우저
            (url.startsWith("http://") || url.startsWith("https://"))
                && !url.startsWith("file://") -> {
                openExternalBrowser(url)
                true
            }
            // 로컬 파일 → WebView에서 처리
            else -> false
        }
    }

    private fun openExternalBrowser(url: String) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
            startActivity(intent)
        } catch (e: Exception) {
            Toast.makeText(this, "브라우저를 열 수 없습니다", Toast.LENGTH_SHORT).show()
        }
    }

    // ==================== 권한 ====================
    private fun requestPermissionsIfNeeded() {
        val notGranted = REQUIRED_PERMISSIONS.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (notGranted.isNotEmpty()) {
            ActivityCompat.requestPermissions(
                this,
                notGranted.toTypedArray(),
                PERMISSION_REQUEST_CODE
            )
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == PERMISSION_REQUEST_CODE) {
            val denied = permissions.zip(grantResults.toTypedArray())
                .filter { it.second != PackageManager.PERMISSION_GRANTED }

            if (denied.any { it.first == Manifest.permission.RECORD_AUDIO }) {
                Toast.makeText(this, "음성 인식을 위해 마이크 권한이 필요합니다", Toast.LENGTH_LONG).show()
            }
        }
    }

    // ==================== 뒤로가기 ====================
    @Deprecated("Using onBackPressed for simplicity")
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            // WebView에서 PC 목록 화면이면 앱 종료, 아니면 뒤로
            webView.evaluateJavascript(
                "(function() { " +
                    "var voiceScreen = document.getElementById('voiceScreen'); " +
                    "if (voiceScreen && voiceScreen.classList.contains('active')) { " +
                    "  goToList(); return 'back'; " +
                    "} " +
                    "var qrScreen = document.getElementById('qrScreen'); " +
                    "if (qrScreen && qrScreen.classList.contains('active')) { " +
                    "  stopQrScan(); return 'back'; " +
                    "} " +
                    "return 'exit'; " +
                    "})()"
            ) { result ->
                if (result == "\"exit\"") {
                    @Suppress("DEPRECATION")
                    super.onBackPressed()
                }
            }
        }
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}
