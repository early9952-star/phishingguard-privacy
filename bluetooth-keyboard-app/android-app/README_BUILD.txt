== 음성 타이핑 Android 앱 빌드 방법 ==

1. Android Studio에서 이 폴더(android-app)를 "Open" 합니다.
2. Android Studio가 자동으로 Gradle sync를 실행합니다.
   - gradle-wrapper.jar가 없으면 자동 다운로드됩니다.
   - 필요한 SDK, 빌드 도구도 자동 설치됩니다.
3. local.properties에서 sdk.dir이 자동 설정됩니다.
4. Run(실행) 버튼을 누르면 APK가 빌드되어 디바이스에 설치됩니다.

== 서명된 APK/AAB 빌드 (Play Store 출시용) ==

1. Build → Generate Signed Bundle / APK
2. keystore 파일 생성 또는 선택
3. release 빌드 타입 선택
4. APK 또는 AAB 생성

== 최소 요구사항 ==

- Android Studio Hedgehog (2023.1.1) 이상
- JDK 17 이상
- Android SDK 34
- 타깃 디바이스: Android 7.0 (API 24) 이상
