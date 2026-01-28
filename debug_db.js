
const { createClient } = require('@supabase/supabase-js');

// Hardcoded for diagnostic purposes (User: DO NOT COMMIT)
// I will try to read these from process env if available, otherwise I'll need to ask user or find them.
// But wait, I can cat .env to see them if I have access. 
// Assuming I can't read .env easily, I'll try to rely on what I saw earlier in logs or just ask.
// Actually, I can try to read app.json or just grep for them.
// I grepped earlier and found nothing.
// Let's assume I can use the values from the previous conversation context or just asking the user is safer?
// No, I should try to read .env file directly if it exists.

const fs = require('fs');
const path = require('path');

async function run() {
    try {
        let supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
        let supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

        // Try reading .env file
        if (!supabaseUrl || !supabaseKey) {
            try {
                const envPath = path.resolve(__dirname, '../../../../../../../.env'); // Adjust path as needed
                // actually let's try reading the .env in root
                const rootEnv = 'c:\\$ Gustavo\\3. Programación\\3.2. Proyectos\\3.2.18. TennisAPP\\TennisAppV1\\.env';
                if (fs.existsSync(rootEnv)) {
                    const envContent = fs.readFileSync(rootEnv, 'utf8');
                    const urlMatch = envContent.match(/EXPO_PUBLIC_SUPABASE_URL=(.*)/);
                    const keyMatch = envContent.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
                    if (urlMatch) supabaseUrl = urlMatch[1].trim();
                    if (keyMatch) supabaseKey = keyMatch[1].trim();
                }
            } catch (e) {
                console.error("Could not read .env", e);
            }
        }

        if (!supabaseUrl || !supabaseKey) {
            console.error("Missing credentials. Please provide EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.");
            return;
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        console.log("Checking last session with instructor_id...");
        const { data: sessions, error } = await supabase
            .from('sessions')
            .select('id, instructor_id, scheduled_at, academy_id')
            .not('instructor_id', 'is', null)
            .limit(1)
            .order('scheduled_at', { ascending: false });

        if (error) {
            console.error("Error fetching session:", error);
            return;
        }

        if (!sessions || sessions.length === 0) {
            console.log("No sessions found with instructor_id.");
            return;
        }

        const session = sessions[0];
        console.log("Found session:", session);

        const instructorId = session.instructor_id;

        // Check staff_members
        const { data: staff, error: staffError } = await supabase
            .from('staff_members')
            .select('id, full_name')
            .eq('id', instructorId);

        console.log("Check staff_members result:", staff, staffError);

        // Check academy_members
        const { data: academyMember, error: amError } = await supabase
            .from('academy_members')
            .select('id, member_name, user_id')
            .eq('id', instructorId);

        console.log("Check academy_members result:", academyMember, amError);

        if (staff && staff.length > 0) {
            console.log("CONCLUSION: instructor_id refers to STAFF_MEMBERS");
        } else if (academyMember && academyMember.length > 0) {
            console.log("CONCLUSION: instructor_id refers to ACADEMY_MEMBERS");
        } else {
            console.log("CONCLUSION: instructor_id ID not found in either table (Orphaned or other table)");
        }

    } catch (err) {
        console.error("Unexpected error:", err);
    }
}

run();
