# تعلّم الفرنسية والألمانية — كيفاش تحطّو على الإنترنت

كاينين 3 ديال الفيشيات:
- `index.html` — التطبيق كامل
- `config.js` — فين كتحط الإعدادات ديال Firebase
- `firestore.rules` — القواعد ديال الحماية (باش حتى واحد ما يشوف التقدّم ديال الآخر)

غادي تحتاج 3 ديال الحسابات (كاملين فابور): **Firebase**، **GitHub**، **Vercel**.

---

## 1) Firebase — الدخول وقاعدة البيانات (10 دقايق)

1. دخل لـ https://console.firebase.google.com بالحساب ديال Google ديالك.
2. **Add project** (ولا Create a project) → كتب سمية (مثلا `lingo`) → طفي Google Analytics → **Create project**.
3. **تفعيل الدخول بـ Google:**
   - فالقائمة: **Build → Authentication → Get started**
   - **Sign-in method → Google → Enable** → اختار الإيميل ديالك فـ "Project support email" → **Save**.
4. **قاعدة البيانات:**
   - **Build → Firestore Database → Create database**
   - Location: اختار شي وحدة فأوروبا (مثلا `eur3` ولا `europe-west`) → **Next**
   - اختار **Start in production mode** → **Create**.
   - من بعد دخل لـ **Rules** (فوق) → مسح داكشي اللي كاين → نسخ كاع المحتوى ديال `firestore.rules` وحطّو → **Publish**.
5. **الإعدادات ديال التطبيق:**
   - ⚙️ **Project settings** (حدا Project Overview) → لتحت فـ **Your apps** → اضغط على **`</>`** (Web).
   - كتب سمية (مثلا `lingo-web`) → **Register app**.
   - غادي يبان ليك كود فيه `const firebaseConfig = { ... }` → نسخ غير داكشي اللي بين `{` و `}`.
   - حل `config.js` وبدّل `null` بداكشي اللي نسختي. خاص يولّي هكا:
     ```js
     window.FIREBASE_CONFIG = {
       apiKey: "AIza...",
       authDomain: "lingo-xxxx.firebaseapp.com",
       projectId: "lingo-xxxx",
       storageBucket: "lingo-xxxx.appspot.com",
       messagingSenderId: "123...",
       appId: "1:123...:web:..."
     };
     ```

> الإعدادات ديال Firebase ماشي سرّية، عادي تكون فالكود. الحماية كتجي من `firestore.rules`.

---

## 2) GitHub — فين كيتحط الكود

1. دخل لـ https://github.com وصايب حساب (ولا دخل).
2. فوق ليمن: **+ → New repository**.
3. Repository name: `lingo` → خليه **Public** → **Create repository**.
4. فالصفحة الجديدة اضغط على **uploading an existing file**.
5. جرّ الفيشيات `index.html` و `config.js` و `firestore.rules` (و README.md إلا بغيتي) → لتحت **Commit changes**.

---

## 3) Vercel — باش يولّي عندك رابط

1. دخل لـ https://vercel.com → **Sign Up → Continue with GitHub**.
2. **Add New… → Project** → لقى `lingo` → **Import**.
3. Framework Preset: **Other** → ما تبدّل والو → **Deploy**.
4. من بعد شي دقيقة غادي يعطيك رابط بحال `https://lingo-xxxx.vercel.app`.

---

## 4) آخر خطوة: سمح للرابط ديالك يدير الدخول

1. رجع لـ Firebase → **Authentication → Settings → Authorized domains → Add domain**.
2. حط الرابط ديالك **بلا** `https://` (مثلا `lingo-xxxx.vercel.app`) → **Add**.

بلا هاد الخطوة، الدخول بـ Google ما غاديش يخدم.

---

## 5) جرّب وصيفط لصحابك

1. حل الرابط → **الدخول بـ Google** → اختار اللغة.
2. دخل لـ **الحساب ديالي** وكتب السمية ديالك فالترتيب.
3. صيفط الرابط لصحابك. كل واحد يدخل بحساب Google ديالو، والتقدّم ديالو كيبقى بوحدو.
4. فصفحة **الأصحاب** كتشوفو شكون حافظ كلمات كثر، بالفرنسية وبالألمانية كل وحدة بوحدها.

---

## كيفاش تبدّل شي حاجة من بعد

بدّل الفيشي فـ GitHub (حلّو → ✏️ → بدّل → **Commit changes**). Vercel كيحدّث الموقع بوحدو من بعد دقيقة.

## ملاحظات
- Firebase فابور (Spark plan) وكافي بزاف لمجموعة ديال الصحاب.
- التقدّم اللي فـ claude.ai ماشي هو نفس التقدّم اللي فالموقع: هوما جوج قواعد بيانات مختلفين.
- إلا ما حطّيتيش الإعدادات فـ `config.js`، التطبيق كيخدم ولكن التقدّم كيتحفظ غير فالتيليفون، والترتيب ما كيخدمش.
