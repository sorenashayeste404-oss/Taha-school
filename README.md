# برنامه ۱۰ مدرسه طاها

پروژه آماده Firebase Hosting برای نمایش برنامه هفتگی سه رشته دهم و دو شعبه، به‌همراه کارهای روزانه و پنل مدیر.

## امکانات

- انتخاب دهم تجربی، دهم ریاضی و دهم انسانی
- انتخاب شعبه ۱ یا ۲
- نمایش برنامه شنبه تا پنجشنبه
- نمایش ساعت و نام درس
- نمایش کارهای روزانه دقیقاً زیر برنامه همان روز
- ورود مدیر با Firebase Authentication
- ثبت، ویرایش و حذف کلاس‌ها
- ثبت، ویرایش و حذف کارهای روزانه
- شمارنده اطلاعات ثبت‌شده در پنل مدیر
- Cloud Firestore به‌عنوان دیتابیس مشترک بین دستگاه‌ها
- Firestore Security Rules برای عمومی‌بودن خواندن برنامه و محدودکردن نوشتن به مدیر
- رابط فارسی و RTL و Responsive
- آماده Firebase Hosting

## ساختار Firestore

### `classes/{classId}`

نمونه:

```json
{
  "major": "experimental",
  "branch": "1",
  "day": "saturday",
  "time": "08:00 - 09:30",
  "subject": "زیست‌شناسی",
  "createdBy": "ADMIN_UID",
  "createdAt": "server timestamp",
  "updatedAt": "server timestamp"
}
```

مقادیر رشته:

- `experimental` = دهم تجربی
- `math` = دهم ریاضی
- `humanities` = دهم انسانی

مقادیر شعبه:

- `"1"` = شعبه ۱
- `"2"` = شعبه ۲

مقادیر روز:

- `saturday`
- `sunday`
- `monday`
- `tuesday`
- `wednesday`
- `thursday`

### `dailyTasks/{taskId}`

نمونه:

```json
{
  "major": "experimental",
  "branch": "1",
  "day": "saturday",
  "title": "حل تمرین صفحه ۴۲",
  "description": "تمرین‌های ۱ تا ۵ انجام شود.",
  "createdBy": "ADMIN_UID",
  "createdAt": "server timestamp",
  "updatedAt": "server timestamp"
}
```

### `admins/{uid}`

این collection برای مجوز مدیر است و از برنامه عمومی جداست.

نمونه سند:

```json
{
  "role": "admin",
  "active": true,
  "email": "admin@example.com"
}
```

`uid` نام سند باید دقیقاً UID حساب مدیر در Firebase Authentication باشد.

## 1. فایل‌ها را کجا قرار بدهم؟

کل پوشه `taha-school-10` را به‌عنوان ریشه پروژه نگه دارید:

```text
taha-school-10/
├── index.html
├── firebase-config.js
├── firebase.json
├── firestore.rules
├── README.md
├── .gitignore
├── css/
│   └── style.css
└── js/
    └── app.js
```

## 2. Firebase Config را کجا وارد کنم؟

در Firebase Console پروژه موجود:

1. وارد Project Overview شوید.
2. روی آیکون Web (`</>`) بروید و اگر Web App ندارید، یک Web App در همان پروژه ثبت کنید؛ پروژه جدید نسازید.
3. Firebase Config نمایش داده‌شده را بردارید.
4. فایل `firebase-config.js` را باز کنید.
5. مقادیر `YOUR_...` را با مقادیر واقعی جایگزین کنید.

مثال:

```js
export const firebaseConfig = {
  apiKey: "AIza....",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

این config طبق معماری Firebase برای Web App است؛ رمز مدیر در آن قرار نمی‌گیرد.

## 3. Firestore را چگونه تنظیم کنم؟

در Firebase Console:

1. وارد `Build > Firestore Database` شوید.
2. اگر Firestore هنوز ساخته نشده، `Create database` را بزنید.
3. دیتابیس را ایجاد کنید.
4. بعد به بخش `Rules` بروید.
5. کل قوانین فعلی را با محتوای فایل `firestore.rules` همین پروژه جایگزین کنید.
6. `Publish` را بزنید.

نکته مهم: قوانین عمداً اجازه می‌دهند دانش‌آموزان `classes` و `dailyTasks` را بخوانند، ولی ایجاد/ویرایش/حذف فقط برای کاربری مجاز است که هم با Firebase Authentication وارد شده و هم سند فعال مدیر در `admins/{uid}` دارد.

### ایجاد مدیر

1. بروید به `Build > Authentication > Users`.
2. روی `Add user` بزنید.
3. ایمیل و یک رمز عبور قوی برای مدیر بسازید.
4. پس از ساخت کاربر، UID او را کپی کنید.
5. بروید به `Firestore Database > Data`.
6. collection جدیدی به نام `admins` بسازید.
7. یک document بسازید که Document ID آن دقیقاً UID مدیر باشد.
8. این فیلدها را اضافه کنید:

```text
role   = "admin"    (string)
active = true       (boolean)
email  = "admin@example.com"   (string)
```

فیلد `email` برای خوانایی است و در Rule ملاک مجوز نیست؛ ملاک `role`, `active` و UID احراز هویت‌شده است.

## 4. Authentication را چگونه تنظیم کنم؟

در Firebase Console:

1. `Build > Authentication`
2. `Get started` اگر هنوز فعال نشده.
3. `Sign-in method`
4. `Email/Password`
5. فعال‌کردن Email/Password
6. ذخیره
7. در تب `Users` حساب مدیر را بسازید.

رمز مدیر داخل JavaScript این پروژه نوشته نشده است.

## 5. Deploy با Firebase CLI

### نصب Firebase CLI

در کامپیوتر دارای Node.js:

```bash
npm install -g firebase-tools
```

سپس:

```bash
firebase login
```

برای بررسی نصب:

```bash
firebase --version
```

### اتصال پوشه به پروژه Firebase موجود

در پوشه پروژه:

```bash
cd taha-school-10
```

سپس:

```bash
firebase use --add
```

پروژه Firebase موجود خودتان را انتخاب کنید.

اگر می‌خواهید از ID پروژه استفاده کنید، می‌توانید در `firebase.json` نیازی به تغییر ندهید و project alias را با CLI تنظیم کنید.

### انتشار

```bash
firebase deploy
```

یا فقط Hosting:

```bash
firebase deploy --only hosting
```

یا Hosting و قوانین Firestore:

```bash
firebase deploy --only hosting,firestore
```

بعد از Deploy، Firebase یک آدرس شبیه زیر می‌دهد:

```text
https://YOUR_PROJECT_ID.web.app
```

## تست قبل از Deploy

به‌دلیل استفاده از ES Modules و Firebase SDK، بهتر است فایل را با یک web server باز کنید و مستقیماً با `file://` اجرا نکنید.

مثلاً اگر Python دارید:

```bash
python -m http.server 8000
```

سپس:

```text
http://localhost:8000
```

یا می‌توانید مستقیم با Firebase Hosting Emulator تست کنید:

```bash
firebase emulators:start
```

## نکته درباره Firestore Index

صفحه دانش‌آموز فقط بر اساس `major` و `branch` query می‌کند و معمولاً نیاز به index خاصی ندارد.

پنل مدیر ابتدا query مرتب‌شده را امتحان می‌کند و اگر Firestore درخواست index بدهد، برنامه fallback بدون `orderBy` دارد تا پنل همچنان قابل استفاده بماند.

## امنیت

Firebase Web Config به‌خودی‌خود رمز مدیر نیست. امنیت این پروژه بر اساس Firebase Authentication و Firestore Security Rules است.

با این حال:
- اطلاعات حساس را در collectionهای عمومی نگذارید.
- حساب مدیر را در اختیار دیگران قرار ندهید.
- Rules را روی `allow read, write: if true` نگذارید.
- اگر بعدها اطلاعات خصوصی دانش‌آموزان اضافه شد، آن اطلاعات باید در collection جدا با Rules جداگانه قرار گیرد.

## تغییر ظاهر و محتوا

رنگ‌ها و ظاهر اصلی در:

```text
css/style.css
```

منطق برنامه در:

```text
js/app.js
```

تنظیمات اتصال Firebase در:

```text
firebase-config.js
```

قرار دارد.
