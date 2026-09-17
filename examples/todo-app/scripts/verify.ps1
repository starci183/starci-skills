param([ValidateSet('dev','vps')][string]$Environment='dev')
$ErrorActionPreference='Stop';$root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path;$compose=Join-Path $root ".stacks/$Environment/compose.yaml";$secret=Join-Path $root ".stacks/$Environment/secrets.yaml";if(-not(Test-Path $secret)){throw 'run prepare first'}
$project="starci-kit-$Environment-$PID";$listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0);$listener.Start();$env:STACK_PORT=([Net.IPEndPoint]$listener.LocalEndpoint).Port;$listener.Stop()
try{docker compose -p $project -f $compose config|Out-Null;if($LASTEXITCODE){throw 'compose config failed'};docker compose -p $project -f $compose up -d --build;if($LASTEXITCODE){throw 'compose up failed'};$network="${project}_default"
 $first=docker run --rm --network $network -v "${secret}:/run/secrets/app_token:ro" -v "${root}/scripts:/probe:ro" node:22.22.0-alpine3.23 node /probe/probe.mjs http://gateway:8080 increment;if($LASTEXITCODE){throw 'first probe failed'}
 docker compose -p $project -f $compose down --remove-orphans|Out-Null;if($LASTEXITCODE){throw 'compose down failed'};docker compose -p $project -f $compose up -d;if($LASTEXITCODE){throw 'compose recreate failed'}
 $second=docker run --rm --network $network -v "${secret}:/run/secrets/app_token:ro" -v "${root}/scripts:/probe:ro" node:22.22.0-alpine3.23 node /probe/probe.mjs http://gateway:8080 read;if($LASTEXITCODE -or $first-ne$second){throw 'persistence proof failed'}
 Write-Host "Cold-start/recreate persistence proof passed for isolated project $project"
}finally{docker compose -p $project -f $compose down --volumes --remove-orphans|Out-Null;Remove-Item Env:STACK_PORT -ErrorAction SilentlyContinue}
