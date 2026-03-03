import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();


const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser() {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', 'mmenaldo@gmail.com')
        .single();

    if (error) {
        console.error('Error fetching profile:', error);
    } else {
        console.log('Profile:', JSON.stringify(data, null, 2));
    }
}

checkUser();
