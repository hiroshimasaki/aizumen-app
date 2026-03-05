const lucide = require('lucide-react');

const icons = ['Download', 'FileJson', 'FileSpreadsheet', 'ShieldCheck', 'AlertCircle', 'Upload', 'FileUp', 'CheckCircle', 'XCircle', 'HardDrive', 'RefreshCw', 'Save', 'LogOut', 'Database', 'BarChart3', 'Settings', 'Zap', 'Menu', 'X', 'CalendarDays', 'TrendingUp', 'AlertTriangle'];

let allExist = true;
for (const icon of icons) {
    if (!lucide[icon]) {
        console.log('MISSING ICON:', icon);
        allExist = false;
    }
}

if (allExist) {
    console.log('ALL ICONS EXIST. No import errors here.');
}
