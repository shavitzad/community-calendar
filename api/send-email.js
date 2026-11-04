export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { events } = req.body;
        const BREVO_API_KEY = process.env.BREVO_API_KEY; 

        // שליחת הנתונים לברבו
        const brevoResponse = await fetch('https://brevo.com', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'content-type': 'application/json',
                'api-key': BREVO_API_KEY
            },
            body: JSON.stringify({
                "email": "forum.raa@gmail.com", // המייל של המנהל שיפעיל את הטריגר
                "listIds":[5], // הגדרת רשימה מספר 5 שלכם
                "updateEnabled": true,
                "params": {
                    "events": events // הזרמת מערך האירועים לקלנדר במייל
                }
            })
        });

        if (brevoResponse.ok) {
            return res.status(200).json({ message: 'Success' });
        } else {
            const err = await brevoResponse.json();
            return res.status(brevoResponse.status).json(err);
        }
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}
