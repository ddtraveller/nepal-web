# Google APIs Implementation Guide
# गुगल एपीआई कार्यान्वयन गाइड

## Common Infrastructure
## साझा पूर्वाधार

### API Key Management
### एपीआई कुञ्जी व्यवस्थापन

The demo uses a Lambda function to securely fetch the API key:
डेमोले एपीआई कुञ्जी सुरक्षित रूपमा प्राप्त गर्न Lambda फंक्सन प्रयोग गर्दछ:

```javascript
async function getApiKeys() {
    try {
        const response = await fetch('https://zuqaonnjhyobeljlum4m6gclae0gdxsp.lambda-url.us-west-2.on.aws/');
        if (!response.ok) {
            throw new Error('Failed to fetch API keys');
        }
        const data = await response.json();
        return data.google_maps_key;
    } catch (error) {
        console.error('Error fetching API key:', error);
        throw error;
    }
}
```

This approach prevents exposing the API key in the client-side code.
यो दृष्टिकोणले क्लाइन्ट-साइड कोडमा एपीआई कुञ्जी उजागर हुनबाट रोक्दछ।

### Tab Management
### ट्याब व्यवस्थापन

The demo uses a tab system to organize different APIs:
डेमोले विभिन्न एपीआईहरू व्यवस्थित गर्न ट्याब प्रणाली प्रयोग गर्दछ:

```javascript
function showTab(tabName) {
    // Hide all sections
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.api-nav button').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected section
    document.getElementById(`${tabName}Section`).classList.add('active');
    document.getElementById(`${tabName}Tab`).classList.add('active');
}
```

## 1. Face Detection API
## १. अनुहार पहिचान एपीआई

### Key Components
### मुख्य घटकहरू

#### Image Loading
#### छवि लोड गर्दै

```javascript
function loadImage(file) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            resolve({ width: img.width, height: img.height });
        };
        img.src = URL.createObjectURL(file);
    });
}
```

This function:
यो फंक्सनले:
- Creates an Image object from the uploaded file
- अपलोड गरिएको फाइलबाट एउटा Image वस्तु सिर्जना गर्दछ
- Draws it on a canvas
- यसलाई क्यानभासमा कोर्दछ
- Returns the image dimensions
- छविको आयामहरू फर्काउँछ

#### Face Detection Request
#### अनुहार पहिचान अनुरोध

```javascript
const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
    method: 'POST',
    body: JSON.stringify({
        requests: [{
            image: { content: base64Image },
            features: [{ type: 'FACE_DETECTION', maxResults: 10 }]
        }]
    })
});
```

Key points:
मुख्य बुँदाहरू:
- Sends image as base64
- छविलाई base64 को रूपमा पठाउँछ
- Requests face detection feature
- अनुहार पहिचान सुविधाको अनुरोध गर्छ
- Limits to 10 results
- नतिजाहरूलाई १० मा सीमित गर्छ

## 2. Natural Language API
## २. प्राकृतिक भाषा एपीआई

### Sentiment Analysis
### भावना विश्लेषण

```javascript
async function analyzeSentiment() {
    const response = await fetch(`https://language.googleapis.com/v1/documents:analyzeSentiment?key=${apiKey}`, {
        method: 'POST',
        body: JSON.stringify({
            document: {
                type: 'PLAIN_TEXT',
                content: text
            }
        })
    });
}
```

Features:
विशेषताहरू:
- Analyzes text sentiment (positive/negative)
- पाठको भावना विश्लेषण गर्छ (सकारात्मक/नकारात्मक)
- Returns sentiment score (-1 to 1)
- भावना स्कोर फर्काउँछ (-१ देखि १)
- Includes magnitude for intensity
- तीव्रताको लागि परिमाण समावेश गर्दछ

Example usage:
प्रयोगको उदाहरण:
```text
Input (इनपुट): "The new restaurant is amazing! The food was delicious."
              "नयाँ रेस्टुरेन्ट अद्भुत छ! खाना स्वादिष्ट थियो।"
Output (आउटपुट): Score: 0.8 (Very Positive), Magnitude: 1.6
                 स्कोर: ०.८ (धेरै सकारात्मक), परिमाण: १.६
```

## 3. Translation API
## ३. अनुवाद एपीआई

### Translation Implementation
### अनुवाद कार्यान्वयन

```javascript
async function translateText() {
    const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}`, {
        method: 'POST',
        body: JSON.stringify({
            q: text,
            target: targetLang,
            source: 'en'
        })
    });
}
```

Features:
विशेषताहरू:
- Supports multiple languages
- धेरै भाषाहरू समर्थन गर्दछ
- Preserves formatting
- ढाँचा संरक्षण गर्दछ
- Automatic language detection (optional)
- स्वचालित भाषा पहिचान (वैकल्पिक)

Example usage:
प्रयोगको उदाहरण:
```text
Input (इनपुट): "Hello world"
Target (लक्षित): Spanish (स्पेनिश)
Output (आउटपुट): "Hola mundo"
```

## 4. Air Quality API
## ४. वायु गुणस्तर एपीआई

### Location Handling
### स्थान व्यवस्थापन

```javascript
function getCurrentLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                document.getElementById('latitude').value = position.coords.latitude;
                document.getElementById('longitude').value = position.coords.longitude;
            },
            (error) => {
                showError('air-results', `Error getting location: ${error.message}`);
            }
        );
    }
}
```

Features:
विशेषताहरू:
- Uses browser geolocation
- ब्राउजर जियोलोकेसन प्रयोग गर्दछ
- Handles location permissions
- स्थान अनुमतिहरू व्यवस्थापन गर्दछ
- Provides error feedback
- त्रुटि प्रतिक्रिया प्रदान गर्दछ

### Air Quality Request
### वायु गुणस्तर अनुरोध

```javascript
async function getAirQuality() {
    const response = await fetch(`https://airquality.googleapis.com/v1/currentConditions:lookup?key=${apiKey}`, {
        method: 'POST',
        body: JSON.stringify({
            location: {
                latitude: parseFloat(lat),
                longitude: parseFloat(lng)
            }
        })
    });
}
```

Features:
विशेषताहरू:
- Real-time air quality data
- वास्तविक-समय वायु गुणस्तर डाटा
- Multiple pollutant measurements
- बहु प्रदूषक मापनहरू
- AQI calculations
- AQI गणनाहरू

## Error Handling
## त्रुटि व्यवस्थापन

Common error handling pattern used throughout:
सम्पूर्ण प्रयोग गरिएको साझा त्रुटि व्यवस्थापन ढाँचा:

```javascript
function showError(elementId, message) {
    document.getElementById(elementId).innerHTML = `
        <div class="error">
            Error: ${message}
        </div>
    `;
}
```

Used in API calls:
एपीआई कलहरूमा प्रयोग गरिएको:

```javascript
try {
    const response = await fetch(url, options);
    const data = await response.json();
    if (data.error) {
        throw new Error(data.error.message);
    }
    // Process data
} catch (error) {
    showError(resultsDivId, error.message);
}
```

This ensures:
यसले सुनिश्चित गर्दछ:
- Consistent error display
- एकरूप त्रुटि प्रदर्शन
- User-friendly messages
- प्रयोगकर्ता-मैत्री सन्देशहरू
- Clear feedback for API issues
- एपीआई समस्याहरूको लागि स्पष्ट प्रतिक्रिया