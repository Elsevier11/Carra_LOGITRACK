# Simple static server per Windows senza Node/Python.
param(
    [string]$Root = ".",
    [int]$Port = 5000
)

Write-Host "Server statico per dist/ su http://localhost:$Port"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://+:$Port/")
$listener.Start()
Write-Host "In ascolto... premi CTRL+C per fermare."

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $path = $request.Url.AbsolutePath.TrimStart('/')
        if ([string]::IsNullOrEmpty($path)) { $path = "index.html" }
        $file = Join-Path $Root $path
        if (-not (Test-Path $file)) {
            $context.Response.StatusCode = 404
            $context.Response.Close()
            continue
        }
        $bytes = [System.IO.File]::ReadAllBytes($file)
        $mime = "text/html"
        switch ([System.IO.Path]::GetExtension($file).ToLower()) {
            ".js" { $mime = "application/javascript" }
            ".css" { $mime = "text/css" }
            ".json" { $mime = "application/json" }
            ".png" { $mime = "image/png" }
            ".jpg" { $mime = "image/jpeg" }
            ".svg" { $mime = "image/svg+xml" }
            default { $mime = "application/octet-stream" }
        }
        $context.Response.ContentType = $mime
        $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
        $context.Response.Close()
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
