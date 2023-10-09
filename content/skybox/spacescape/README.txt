Made with spacescape, http://alexcpeterson.com/spacescape
If some of these look like made by children, that's because they are :)
After exporting jpgs from spacescape, just rename them like

for f in *BK.jpg; do mv $f "$(echo "$f" | sed s/BK/_nz/)"; done
for f in *FT.jpg; do mv $f "$(echo "$f" | sed s/FT/_pz/)"; done
for f in *LF.jpg; do mv $f "$(echo "$f" | sed s/LF/_nx/)"; done
for f in *RT.jpg; do mv $f "$(echo "$f" | sed s/RT/_px/)"; done
for f in *DN.jpg; do mv $f "$(echo "$f" | sed s/DN/_ny/)"; done
for f in *UP.jpg; do mv $f "$(echo "$f" | sed s/UP/_py/)"; done
