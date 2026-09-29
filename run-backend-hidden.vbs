Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "C:\Users\nisha\Downloads\crm\RS-CRM\slar-2.0"
shell.Run "cmd.exe /d /s /c ""cd /d C:\Users\nisha\Downloads\crm\RS-CRM\slar-2.0 && call start-backend-localhost.bat""", 0, False
