# Публикация репозитория на GitHub
# Использование: .\scripts\publish-to-github.ps1 -Token "ghp_ВАШ_ТОКЕН"

param(
    [Parameter(Mandatory = $true)]
    [string]$Token,

    [string]$Owner = "rogirem",
    [string]$Repo = "smart_vnimanie_foundraising"
)

$ErrorActionPreference = "Stop"

$headers = @{
    Authorization = "token $Token"
    "User-Agent"  = "PowerShell"
    Accept        = "application/vnd.github+json"
}

Write-Host "Проверка токена..."
$user = Invoke-RestMethod -Uri "https://api.github.com/user" -Headers $headers
Write-Host "Авторизован как: $($user.login)"

$repoUrl = "https://api.github.com/repos/$Owner/$Repo"
try {
    $existing = Invoke-RestMethod -Uri $repoUrl -Headers $headers
    Write-Host "Репозиторий уже существует: $($existing.html_url)"
}
catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 404) {
        Write-Host "Создание репозитория $Owner/$Repo ..."
        $body = @{
            name        = $Repo
            description = "Demo crypto fundraising platform for Fond Vnimanie"
            private     = $false
        } | ConvertTo-Json
        $created = Invoke-RestMethod -Uri "https://api.github.com/user/repos" -Method Post -Headers $headers -Body $body -ContentType "application/json"
        Write-Host "Создан: $($created.html_url)"
    }
    else {
        throw
    }
}

$remote = "https://$Owner`:$Token@github.com/$Owner/$Repo.git"
git remote remove origin 2>$null
git remote add origin $remote

Write-Host "Отправка кода на GitHub..."
git push -u origin main

git remote set-url origin "https://github.com/$Owner/$Repo.git"
Write-Host "Готово: https://github.com/$Owner/$Repo"
