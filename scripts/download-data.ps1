# Downloads every raw source file into data\raw. Safe to re-run: existing files are skipped.
# Run from the repo root in VS Code:  powershell -ExecutionPolicy Bypass -File scripts\download-data.ps1
$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'   # makes Invoke-WebRequest ~10x faster
$raw = Join-Path $PSScriptRoot '..\data\raw'
New-Item -ItemType Directory -Force -Path $raw | Out-Null
$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36'

function Get-File($name, [string[]]$urls, [switch]$Optional) {
  $dest = Join-Path $raw $name
  if ((Test-Path $dest) -and ((Get-Item $dest).Length -gt 1000)) { Write-Host "skip  $name (exists)"; return }
  foreach ($u in $urls) {
    try {
      Invoke-WebRequest -Uri $u -OutFile $dest -UserAgent $ua -TimeoutSec 900
      $mb = [math]::Round((Get-Item $dest).Length / 1MB, 1)
      Write-Host "ok    $name  ($mb MB)  <- $u"; return
    } catch { Write-Host "  fail $u : $($_.Exception.Message)" }
  }
  if (Test-Path $dest) { Remove-Item $dest }
  if ($Optional) { Write-Host "MISSING (optional) $name" } else { Write-Host "MISSING $name" -ForegroundColor Red }
}

# IRS SOI individual income tax ZIP code data, all states, by AGI size class
foreach ($y in 11..22) { Get-File "${y}zpallagi.csv" @("https://www.irs.gov/pub/irs-soi/${y}zpallagi.csv") }
# 2023 may not be published yet; picked up automatically when it is
Get-File "23zpallagi.csv" @("https://www.irs.gov/pub/irs-soi/23zpallagi.csv") -Optional
Get-File "22zpdoc.docx" @("https://www.irs.gov/pub/irs-soi/22zpdoc.docx") -Optional

# Census 2020 ZCTA boundaries (cartographic, 1:500k)
Get-File "cb_2020_us_zcta520_500k.zip" @("https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_zcta520_500k.zip")
# 2023 county boundaries (includes Connecticut's planning regions, used by the 2023 metro definitions)
Get-File "cb_2023_us_county_500k.zip" @("https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_county_500k.zip")
# 2020 ZCTA gazetteer (internal points, land area)
Get-File "2020_Gaz_zcta_national.zip" @("https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2020_Gazetteer/2020_Gaz_zcta_national.zip")
# 2020 block-group centers of population (for population-weighted ZIP points)
Get-File "CenPop2020_Mean_BG.txt" @("https://www2.census.gov/geo/docs/reference/cenpop2020/blkgrp/CenPop2020_Mean_BG.txt")
# 2010 block-group centers of population (growth path for estimated new ZIPs)
Get-File "CenPop2010_Mean_BG.txt" @("https://www2.census.gov/geo/docs/reference/cenpop2010/blkgrp/CenPop2010_Mean_BG.txt")
# ZCTA -> place relationship (ZIP place names)
Get-File "tab20_zcta520_place20_natl.txt" @("https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_place20_natl.txt") -Optional
# OMB metro delineation, July 2023
Get-File "list1_2023.xlsx" @("https://www2.census.gov/programs-surveys/metro-micro/geographies/reference-files/2023/delineation-files/list1_2023.xlsx")
# Metro population estimates for ranking (newest vintage available)
Get-File "cbsa-est-alldata.csv" @(
  "https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/metro/totals/cbsa-est2025-alldata.csv",
  "https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/metro/totals/cbsa-est2024-alldata.csv") -Optional
# USPS ZIP points incl. PO-box ZIPs (GeoNames, CC-BY 4.0)
Get-File "geonames_US.zip" @("https://download.geonames.org/export/zip/US.zip")
# CPI-U, monthly (check against the annual averages hardcoded in the pipeline)
Get-File "CPIAUCNS.csv" @("https://fred.stlouisfed.org/graph/fredgraph.csv?id=CPIAUCNS") -Optional

Write-Host "`nDone. Files in $raw :"
Get-ChildItem $raw | Select-Object Name, @{n='MB';e={[math]::Round($_.Length/1MB,1)}} | Format-Table -AutoSize
