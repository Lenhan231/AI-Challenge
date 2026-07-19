import requests

API_KEY = "AQ.Ab8RN6Ks5JpEILAIXZ_c6fKWObwv41uir-BNA0uub7FirHZGBA"

url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent"

headers = {
    "Content-Type": "application/json",
    "X-goog-api-key": API_KEY,
}

payload = {
    "contents": [
        {
            "parts": [
                {
                    "text": "Explain how AI works in a few words"
                }
            ]
        }
    ]
}

response = requests.post(url, headers=headers, json=payload)

print(response.status_code)
print(response.text)