# Neon Wilds Snake — Online Multiplayer (Hindi)

इस प्रोजेक्ट में HTML गेम और Node.js + Socket.IO सर्वर शामिल है। खिलाड़ी होस्टेड लिंक खोलकर `CREATE ROOM` दबाता है; फिर 5-अक्षरों का रूम कोड दोस्तों को भेजता है। दोस्त उसी लिंक पर कोड डालकर `JOIN ROOM` दबाते हैं। सर्वर अधिकतम 8 खिलाड़ियों को एक कमरे में जोड़ता है और लाइव स्नेक पोज़िशन/बॉडी रिले करता है। होस्ट का खाना और पावर-अप स्टेट भी अन्य खिलाड़ियों को सिंक किया जाता है। AI बॉट्स हर क्लाइंट पर लोकली चलते हैं, इसलिए अभी बॉट्स की चाल और collision/score पूरी तरह authoritative/shared नहीं हैं।

## मुफ़्त Render होस्टिंग

1. इस ZIP को extract करें।
2. पूरी `neon_wilds_online` फ़ोल्डर GitHub repository में upload करें (GitHub account की ज़रूरत होगी)। `package.json`, `server.js`, `render.yaml` और `public/index.html` repository root में रहें।
3. Render.com पर sign in करके **New + → Web Service** चुनें और अपनी GitHub repository connect करें।
4. Settings:
   - Runtime: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance: Free (अगर उपलब्ध हो)
5. Deploy पूरा होने के बाद Render द्वारा दिया गया `https://....onrender.com` URL खोलें। यही लिंक दोस्तों को भेजें।
6. पहला खिलाड़ी `CREATE ROOM` दबाए और दिखा हुआ room code शेयर करे। दोस्त उसी वेबसाइट पर `JOIN ROOM` करें।

`render.yaml` Render settings auto-detect करने में मदद करता है; अगर Render blueprint import कर रहे हों, तो उसी YAML से service बनाई जा सकती है।

## लोकल टेस्ट

Node.js 18+ install करके project folder में चलाएँ:

```bash
npm install
npm start
```

फिर `http://localhost:3000` खोलें। एक ही कंप्यूटर पर अलग-अलग browser tabs से टेस्ट कर सकते हैं। फोन से टेस्ट करने के लिए दोनों डिवाइस उसी Wi-Fi पर हों और कंप्यूटर का local IP तथा port `3000` इस्तेमाल करें।

## ज़रूरी नोट

- यह सिर्फ HTML फ़ाइल की तरह offline खोलने से ऑनलाइन नहीं चलेगा; Render पर सर्वर deploy होना चाहिए।
- Free hosting पर service idle होने पर sleep हो सकती है, इसलिए पहली बार connect होने में थोड़ा समय लग सकता है।
- अभी real-time player movement server से relay होती है; food state host से sync होती है, लेकिन bot AI, food pickup, collision, score और game rules अभी पूर्ण server-authoritative नहीं हैं। इसे production-grade multiplayer बनाने के लिए server-side simulation, reconnection handling और abuse protection आगे जोड़ने होंगे।
