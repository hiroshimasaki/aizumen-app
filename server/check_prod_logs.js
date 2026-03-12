require('dotenv').config({ path: './.env' });
const { supabaseAdmin } = require('./src/config/supabase');


async function checkLogs() {
    console.log('Fetching error logs containing "Analysis failed" or "OCR"...');
    const { data: logs, error } = await supabaseAdmin
        .from('system_error_logs')
        .select('*')
        .or('message.ilike.%Analysis failed%,message.ilike.%OCR%,path.ilike.%/api/ocr/%')
        .order('created_at', { ascending: false })
        .limit(20);




    if (error) {
        console.error('Error fetching logs:', error);
        return;
    }

    logs.forEach(log => {
        console.log('---');
        console.log(`Time: ${log.created_at}`);
        console.log(`Path: ${log.path}`);
        console.log(`Message: ${log.message}`);
        console.log(`Stack: ${log.stack?.substring(0, 500)}...`);
    });
}

checkLogs();
