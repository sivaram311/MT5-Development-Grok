# 1. Define your command blocks
$tab1Commands = @"
cd E:\Source\grok_dev\python
echo 'Starting run_data_downloader.py'
python run_data_downloader.py
PS
"@

$tab2Commands = @"
cd E:\Source\grok_dev\frontend
echo 'Starting frontend - Angular'
ng serve
PS
"@

$tab3Commands = @"
cd E:\Source\grok_dev\backend
echo 'Starting backend - Springboot'
mvn spring-boot:run
PS
"@

# 2. Save them to temporary runner scripts in your project folder
$runner1 = "E:\Source\grok_dev\python\run_tab1.ps1"
$runner2 = "E:\Source\grok_dev\python\run_tab2.ps1"
$runner3 = "E:\Source\grok_dev\python\run_tab3.ps1"

Set-Content -Path $runner1 -Value $tab1Commands
Set-Content -Path $runner2 -Value $tab2Commands
Set-Content -Path $runner3 -Value $tab3Commands

# 3. Build the Windows Terminal execution string pointing directly to the files
$wtArgs = "nt -d `"E:\Source\grok_dev\python`" powershell -noExit -File `"$runner1`""
$wtArgs += " ; nt -d `"E:\Source\grok_dev\python`" powershell -noExit -File `"$runner2`""
$wtArgs += " ; nt -d `"E:\Source\grok_dev\python`" powershell -noExit -File `"$runner3`""

# 4. Launch cleanly
Start-Process "wt" -ArgumentList $wtArgs