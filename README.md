# الطقس

موقع طقس عربي باتجاه RTL، مبني باستخدام HTML وCSS وJavaScript دون أطر عمل أو مكتبات خارجية. يعرض الطقس الحالي، توقعات الساعات والأيام، رسمًا بيانيًا للحرارة والهطول، وجودة الهواء. يمكن البحث عن المدن أو استخدام الموقع الحالي، وتبديل وحدات الحرارة والرياح.

## التشغيل المحلي

1. نزّل المشروع أو افتح مجلده في مستكشف الملفات.
2. افتح `index.html` في المتصفح.
3. اسمح باتصال الإنترنت حتى يتمكن الموقع من جلب البيانات من Open-Meteo.

> قد يمنع المتصفح بعض طلبات الشبكة أو تحديد الموقع عند فتح الصفحة مباشرة باستخدام `file://`. إذا لم تُحمّل البيانات، شغّل الموقع من خادم محلي عبر `localhost` (مثل إضافة Live Server في VS Code)، أو انشره عبر HTTPS. ميزة تحديد الموقع تتطلب HTTPS أو `localhost`.

## مصادر البيانات

يستخدم الموقع خدمات Open-Meteo المجانية، ولا يحتاج إلى مفتاح API:

- توقعات الطقس: [Open-Meteo Forecast API](https://open-meteo.com/en/docs)
- البحث عن المدن والإحداثيات: [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api)
- جودة الهواء: [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api)

## تغيير المنطقة الافتراضية

افتح `js/main.js` وعدّل الثابت `DEFAULT_LOCATION` الموجود في أعلى الملف. غيّر الاسم وخطي العرض والطول إلى المنطقة المطلوبة:

```js
const DEFAULT_LOCATION = Object.freeze({
  name: "دمشق",
  latitude: 33.5138,
  longitude: 36.2765,
});
```

استخدم إحداثيات صحيحة: خط العرض بين `-90` و`90`، وخط الطول بين `-180` و`180`. سيظل الموقع الذي اختاره المستخدم محفوظًا في المتصفح، وقد يُعرض بدل الافتراضي عند الزيارة التالية. لمسح الموقع المحفوظ، امسح بيانات الموقع من إعدادات المتصفح أو نفّذ `localStorage.removeItem("weather-site-location")` في وحدة تحكم المطور.

## النشر مجانًا على GitHub Pages

الموقع ثابت ولا يحتاج إلى بناء أو تثبيت حزم. حافظ على بنية الملفات كما هي (`index.html` ومجلدا `css` و`js`).

1. سجّل الدخول إلى [GitHub](https://github.com) وأنشئ مستودعًا جديدًا عبر **New repository**. اجعله **Public** إذا كنت تستخدم خطة GitHub Free، واختر اسمًا مثل `weather-site`.
2. افتح PowerShell داخل مجلد المشروع. نفّذ الأوامر التالية، واستبدل `YOUR-USERNAME` و`weather-site` باسم حسابك واسم المستودع:

   ```powershell
   git init
   git add index.html css js README.md
   git commit -m "Publish weather site"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/weather-site.git
   git push -u origin main
   ```

   إذا كان المجلد مرتبطًا بمستودع Git مسبقًا، لا تكرر `git init` أو `git remote add origin`؛ استخدم عنوان المستودع الحالي، ثم أضف التغييرات واعمل commit وpush.
3. في صفحة المستودع على GitHub، افتح **Settings** ثم **Pages**.
4. ضمن **Build and deployment**، اختر **Deploy from a branch**.
5. اختر الفرع `main` والمجلد `/(root)`، ثم اضغط **Save**.
6. انتظر اكتمال النشر. سيظهر رابط الموقع في صفحة **Settings → Pages**، ويكون عادةً:

   ```text
   https://YOUR-USERNAME.github.io/weather-site/
   ```

7. افتح الرابط عبر HTTPS واختبر تحميل الطقس والبحث عن المدن. استخدم زر الموقع الحالي وامنح إذن الموقع عند السؤال.

عند كل تحديث، أرسل التغييرات إلى فرع `main` ليعيد GitHub Pages نشر الموقع.

## بديل سريع: Netlify Drop

1. سجّل الدخول إلى [Netlify](https://www.netlify.com/) أو أنشئ حسابًا مجانيًا.
2. افتح [Netlify Drop](https://app.netlify.com/drop).
3. اسحب **مجلد المشروع الذي يحتوي مباشرةً على `index.html` ومجلدي `css` و`js`** إلى منطقة الرفع. لا ترفع مجلدًا أبًا يحتوي المشروع بداخله؛ يجب أن يكون `index.html` في جذر المجلد المرفوع.
4. انتظر اكتمال الرفع، ثم افتح رابط HTTPS الذي يعرضه Netlify.
5. عند تعديل الموقع، ارفع المجلد المحدّث بالطريقة نفسها.

