async function sendWeeklySummaryToBrevo() {
    try {
        // 1. משיכת ה-JSON המקומי
        const response = await fetch('./events.json');
        const jsonData = await response.json();

        // 2. קריאה לשרת ה-Vercel שלנו (הוא כבר מכיר את המפתח בסתר)
        const vercelResponse = await fetch('/api/send-email', {
            method: 'POST',
            headers: {
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                events: jsonData.events
            })
        });

        if (vercelResponse.ok) {
            alert('🚀 העדכון השבועי נשלח בהצלחה לכל תושבי מזכרת בתיה!');
        } else {
            alert('שגיאה בשליחה, בדקו את ה-Console ב-Vercel');
        }
    } catch (error) {
        console.error(error);
        alert('שגיאה בתהליך השליחה');
    }
}
