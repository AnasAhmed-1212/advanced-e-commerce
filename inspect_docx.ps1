param(
    [Parameter(Mandatory=$true)][string]$DocxPath,
    [Parameter(Mandatory=$true)][string]$OutputDir
)

$ErrorActionPreference = 'Stop'
$stage = Join-Path $OutputDir 'package'
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
New-Item -ItemType Directory -Force -Path $stage | Out-Null
$zip = Join-Path $OutputDir 'document.zip'
Copy-Item -LiteralPath $DocxPath -Destination $zip -Force
Expand-Archive -LiteralPath $zip -DestinationPath $stage -Force

$ns = New-Object System.Xml.XmlNamespaceManager((New-Object System.Xml.NameTable))
$ns.AddNamespace('w','http://schemas.openxmlformats.org/wordprocessingml/2006/main')
$ns.AddNamespace('a','http://schemas.openxmlformats.org/drawingml/2006/main')

function Get-NodeText([System.Xml.XmlNode]$node) {
    $parts = @()
    foreach ($n in $node.SelectNodes('.//w:t | .//w:delText | .//w:tab | .//w:br | .//a:t', $ns)) {
        if ($n.LocalName -eq 'tab') { $parts += "`t" }
        elseif ($n.LocalName -eq 'br') { $parts += "`n" }
        else { $parts += $n.InnerText }
    }
    return ($parts -join '')
}

function Export-WordPart([string]$path, [string]$label, [string]$outFile) {
    if (-not (Test-Path -LiteralPath $path)) { return }
    [xml]$xml = Get-Content -LiteralPath $path -Raw
    $lines = @("=== $label ===")
    $body = $xml.SelectSingleNode('//w:body', $ns)
    if ($null -eq $body) { $body = $xml.DocumentElement }
    foreach ($child in $body.ChildNodes) {
        if ($child.LocalName -eq 'p') {
            $styleNode = $child.SelectSingleNode('./w:pPr/w:pStyle', $ns)
            $style = if ($styleNode) { $styleNode.GetAttribute('val','http://schemas.openxmlformats.org/wordprocessingml/2006/main') } else { '' }
            $text = Get-NodeText $child
            if ($text -or $style) { $lines += "[P style=$style] $text" }
        } elseif ($child.LocalName -eq 'tbl') {
            $lines += '[TABLE]'
            foreach ($row in $child.SelectNodes('./w:tr', $ns)) {
                $cells = foreach ($cell in $row.SelectNodes('./w:tc', $ns)) { (Get-NodeText $cell) -replace "`r?`n", ' / ' }
                $lines += ('| ' + ($cells -join ' | ') + ' |')
            }
            $lines += '[/TABLE]'
        }
    }
    Set-Content -LiteralPath $outFile -Value $lines -Encoding utf8
}

Export-WordPart (Join-Path $stage 'word\document.xml') 'MAIN DOCUMENT' (Join-Path $OutputDir 'main.txt')
Get-ChildItem -LiteralPath (Join-Path $stage 'word') -Filter 'header*.xml' -ErrorAction SilentlyContinue | ForEach-Object {
    Export-WordPart $_.FullName $_.Name (Join-Path $OutputDir ($_.BaseName + '.txt'))
}
Get-ChildItem -LiteralPath (Join-Path $stage 'word') -Filter 'footer*.xml' -ErrorAction SilentlyContinue | ForEach-Object {
    Export-WordPart $_.FullName $_.Name (Join-Path $OutputDir ($_.BaseName + '.txt'))
}

foreach ($special in @('footnotes','endnotes','comments')) {
    $path = Join-Path $stage ("word\$special.xml")
    if (Test-Path -LiteralPath $path) {
        [xml]$xml = Get-Content -LiteralPath $path -Raw
        $lines = @("=== $special ===")
        foreach ($node in $xml.DocumentElement.ChildNodes) {
            $text = Get-NodeText $node
            if ($text) { $lines += "[$($node.LocalName)] $text" }
        }
        Set-Content -LiteralPath (Join-Path $OutputDir ($special + '.txt')) -Value $lines -Encoding utf8
    }
}

$media = Join-Path $stage 'word\media'
$mediaCount = if (Test-Path -LiteralPath $media) { (Get-ChildItem -LiteralPath $media -File).Count } else { 0 }
$mainXmlPath = Join-Path $stage 'word\document.xml'
[xml]$mainXml = Get-Content -LiteralPath $mainXmlPath -Raw
$stats = [ordered]@{
    paragraphs = $mainXml.SelectNodes('//w:body/w:p', $ns).Count
    tables = $mainXml.SelectNodes('//w:body/w:tbl', $ns).Count
    table_rows = $mainXml.SelectNodes('//w:body/w:tbl/w:tr', $ns).Count
    images = $mediaCount
    insertions = $mainXml.SelectNodes('//w:ins', $ns).Count
    deletions = $mainXml.SelectNodes('//w:del', $ns).Count
    comments = $mainXml.SelectNodes('//w:commentRangeStart', $ns).Count
    sections = $mainXml.SelectNodes('//w:sectPr', $ns).Count
}
$stats | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $OutputDir 'stats.json') -Encoding utf8
$stats | Format-List
