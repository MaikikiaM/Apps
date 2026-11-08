$songs = @(
    @{ name = "Soy Rebelde - Jeanette"; query = "ytsearch1:Jeanette Soy Rebelde audio" },
    @{ name = "Por que te vas - Jeanette"; query = "ytsearch1:Jeanette Por que te vas audio" },
    @{ name = "La Llorona - Chavela Vargas"; query = "ytsearch1:Chavela Vargas La Llorona audio" },
    @{ name = "Zigeunerweisen - Pablo Sarasate"; query = "ytsearch1:Pablo Sarasate Zigeunerweisen audio" },
    @{ name = "Paint It Black - The Rolling Stones"; query = "ytsearch1:Rolling Stones Paint It Black audio" },
    @{ name = "Viva La Vida - Coldplay"; query = "ytsearch1:Coldplay Viva La Vida audio" },
    @{ name = "Libre - Nino Bravo"; query = "ytsearch1:Nino Bravo Libre audio" },
    @{ name = "Fairytale - Alexander Rybak"; query = "ytsearch1:Alexander Rybak Fairytale audio" },
    @{ name = "Gangsta Paradise - Coolio"; query = "ytsearch1:Coolio Gangstas Paradise audio" },
    @{ name = "Back in Black - ACDC"; query = "ytsearch1:ACDC Back in Black audio" },
    @{ name = "Un beso y una flor - Nino Bravo"; query = "ytsearch1:Nino Bravo Un beso y una flor audio" }
)

foreach ($s in $songs) {
    $outPath = "c:\Users\migue\Antigravity\songs\" + $s.name + ".%(ext)s"
    Write-Output ("Descargando pista real: " + $s.name)
    & "c:\Users\migue\Antigravity\yt-dlp.exe" -f "bestaudio" --no-playlist -o $outPath $s.query
}

Write-Output "¡Todas las pistas reales descargadas!"
