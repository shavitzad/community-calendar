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

        const brevoResponse = await fetch('https://brevo.com', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'content-type': 'application/json',
                'api-key': BREVO_API_KEY
            },
            body: JSON.stringify({
                "to": [
                    {
                        "email": "forum.raa@gmail.com",
                        "name": "מנהל המערכת"
                    }
                ],
                "templateId": 2, 
                "params": {
                    "events": eventsText
                }
            })
        });

        // תיקון: אם הסטטוס תקין (200 או 201), מחזירים הצלחה מיד בלי לנסות לקרוא JSON ריק מברבו
        if (brevoResponse.ok || brevoResponse.status === 201) {
            return res.status(200).json({ message: 'Success' });
        } 
        
        // רק אם יש שגיאה אמיתית, ננסה לקרוא את תוכן השגיאה
        let errorData;
        try {
            errorData = await brevoResponse.json();
        } catch (e) {
            errorData = { message: 'Failed to parse Brevo error response' };
        }
        
        return res.status(brevoResponse.status).json(errorData);

    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}
