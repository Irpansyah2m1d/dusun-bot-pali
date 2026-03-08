# Dusun Bot PALI 🤖

**Dusun Bot** adalah Open-Source API chatbot dan mesin terjemahan Bahasa Dusun PALI (Penukal Abab Lematang Ilir), Sumatera Selatan. Project ini bertujuan untuk melestarikan dialek lokal PALI melalui teknologi AI (Artificial Intelligence) dengan metode RAG (*Retrieval-Augmented Generation*).

Project ini diinisiasi oleh **Irpansyah - Kampung Digital Air Itam** (@mpai_belajo).

---

## 🚀 Fitur Utama
*   **Chatbot AI**: Asisten yang bisa mengobrol dalam dialek PALI yang kental.
*   **Kamus Terjemahan**: Pencarian kosa kata bolak-balik (Indonesia <-> Dusun PALI).
*   **Mesin Translate**: Terjemahan kalimat panjang (Google Translate-like) dengan cerdas.

---

## 🛠️ Persyaratan & Instalasi

1. **Clone Repository**:
   ```bash
   git clone https://github.com/username/dusun-ai.git
   cd dusun-ai
   ```

2. **Install Dependensi**:
   ```bash
   npm install
   ```

3. **Jalankan Lokal**:
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
      "provider": "gemini",
      "userApiKey": "API_KEY_GEMINI_ANDA"
    }
    ```

### 2. Kamus Search (`/api/kamus`)
Endpoint untuk mencari kosa kata tanpa menggunakan AI (Gratis & Cepat).
*   **Method**: `GET` / `POST`
*   **Query Params (GET)**: `?q=makan`
*   **Body (POST)**:
    ```json
    {
      "query": "makan"
    }
    ```

### 3. Translate AI (`/api/translate`)
Endpoint untuk menejermahkan kalimat panjang secara akurat tanpa basa-basi.
*   **Method**: `POST`
*   **Body (JSON)**:
    ```json
    {
      "text": "Besok saya ingin pergi ke pasar bersama ibu saya.",
      "direction": "id-to-dusun", // Pilihan: "id-to-dusun" atau "dusun-to-id"
      "provider": "gemini",
      "userApiKey": "API_KEY_GEMINI_ANDA"
    }
    ```

---

## ⚠️ Status Data Kamus
Saat ini kosa kata yang terdaftar masih sangat terbatas (sekitar **500+ data**). Kami terus melakukan update secara berkala untuk meningkatkan akurasi terjemahan dan chatbot.

---

## 🤝 Kontribusi & Dukungan
Kami sangat terbuka bagi siapa saja yang ingin berkontribusi menambah kosa kata atau memperbaiki dialek mesin ini. Jika Anda ingin membantu atau bertanya, silakan hubungi:

📧 **Email**: [kampungdigitalairitam@gmail.com](mailto:kampungdigitalairitam@gmail.com)  
📱 **WhatsApp**: [Kontak Irpansyah](https://wa.me/your-whatsapp-number) *(Silakan ganti URL dengan nomor Anda)*  
📸 **Instagram**: [@mpai_belajo](https://instagram.com/mpai_belajo)

---

Dari **Kampung Digital Air Itam** untuk pelestarian budaya lokal. Payo kitek lestarike base kitek dewek! wkwkwkkw! 🚀🔥
