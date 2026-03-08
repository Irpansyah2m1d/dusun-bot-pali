# Dusun Bot PALI 🤖

**Dusun Bot** adalah Open-Source API chatbot dan mesin terjemahan Bahasa Dusun PALI (Penukal Abab Lematang Ilir), Sumatera Selatan. Project ini bertujuan untuk melestarikan dialek lokal PALI melalui teknologi AI (Artificial Intelligence) dengan metode RAG (*Retrieval-Augmented Generation*).

---

## 🌐 Live Demo & Landing Page
Akses fitur dan dokumentasi UI di: **[https://dusun-bot-pali.vercel.app](https://dusun-bot-pali.vercel.app)**

---

## 🚀 Fitur Utama
*   **Chatbot AI**: Asisten yang bisa mengobrol dalam dialek PALI yang kental.
*   **Kamus Terjemahan**: Pencarian kosa kata bolak-balik (Indonesia <-> Dusun PALI).
*   **Mesin Translate**: Terjemahan kalimat panjang (Google Translate-like) dengan cerdas.

---

## 🛠️ Persyaratan & Instalasi

1. **Clone Repository**:
   ```bash
   git clone https://github.com/Irpansyah2m1d/dusun-bot-pali.git
   cd dusun-bot-pali
   ```

2. **Install Dependensi**:
   ```bash
   npm install
   ```

3. **Dapatkan API Key**:
   Untuk menggunakan fitur Chat dan Translate, dengo butuh API Key dari salah satu provider berikut:
   *   **Google Gemini** (Sangat Direkomendasikan): [Dapatkan di Google AI Studio](https://aistudio.google.com/app/apikey)
   *   **Groq Cloud**: [Dapatkan di Groq Console](https://console.groq.com/keys)
   *   **Z.ai**: [Dapatkan di Z.ai Platform](https://z.ai/)

4. **Jalankan Lokal**:
   ```bash
   npm run dev
   ```

---

## 📖 Dokumentasi Endpoint API

Kami sangat merekomendasikan penggunaan **Google Gemini API** (`gemini-flash-latest`) untuk mendapatkan hasil dialek yang paling natural.

### 1. Chatbot (`/api/chat`)
Endpoint untuk mengobrol santai dengan Dusun Bot.
*   **Method**: `POST`
*   **Body (JSON)**:
    ```json
    {
      "prompt": "Halo dusun bot, lagi ngape serekak ikak?",
      "provider": "gemini", // Pilihan: "gemini", "groq", atau "zai"
      "userApiKey": "API_KEY_DENGIO"
    }
    ```

### 2. Kamus Search (`/api/kamus`)
Endpoint untuk mencari kosa kata tanpa menggunakan AI (Gratis & Cepat).
*   **Method**: `GET` / `POST`

### 3. Translate AI (`/api/translate`)
Endpoint untuk menejermahkan kalimat panjang secara akurat tanpa basa-basi.
*   **Method**: `POST`

---

## ⚠️ Status Data Kamus
Saat ini kosa kata yang terdaftar masih sangat terbatas (sekitar **500+ data**). Kami terus melakukan update secara berkala untuk meningkatkan akurasi terjemahan dan chatbot.

---

## 🤝 Kontribusi & Dukungan
Kami sangat terbuka bagi siapa saja yang ingin berkontribusi menambah kosa kata atau memperbaiki dialek mesin ini. Jika Anda ingin membantu atau bertanya, silakan hubungi:

📧 **Email**: [kampungdigitalairitam@gmail.com](mailto:kampungdigitalairitam@gmail.com)  
📱 **WhatsApp**: [082281488763](https://wa.me/6282281488763)  
📸 **Instagram**: [@mpai_belajo](https://instagram.com/mpai_belajo)  
🌐 **Portfolio**: [irpansyah.vercel.app](https://irpansyah.vercel.app/)  
🏢 **Komunitas**: [kdai.my.id](https://kdai.my.id)

---

Dari **Kampung Digital Air Itam** untuk pelestarian budaya lokal. Payo kitek lestarike base kitek dewek! wkwkwkkw! 🚀🔥
