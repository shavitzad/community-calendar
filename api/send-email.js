export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { events } = req.body;
        const BREVO_API_KEY = process.env.BREVO_API_KEY; 

        if (!BREVO_API_KEY) {
            return res.status(500).json({ message: 'Brevo API Key is missing' });
        }

        // המרת מערך האירועים לטקסט קריא עבור התבנית בברבו
        const eventsText = typeof events === 'object' ? JSON.stringify(events, null, 2) : events;

        const brevoResponse = await fetch('https://api.brevo.com', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'content-type': 'application/json',
                'api-key': BREVO_API_KEY
            },
            body: JSON.stringify({
                // הנמען שיקבל את המייל עם האירועים
                "to": [
                    {
                        "email": "forum.raa@gmail.com",
                        "name": "מנהל המערכת"
                    }
                ],
                // שימוש ב-ID של התבנית הפעילה שלכם
                "templateId": 2, 
                "params": {
                    "events": eventsText
                }
            })
        });

        if (brevoResponse.status === 201 || brevoResponse.ok) {
            return res.status(200).json({ message: 'Success' });
        } else {
            const err = await brevoResponse.json();
            return res.status(brevoResponse.status).json(err);
        }
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}
