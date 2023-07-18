package main

import (
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"log"
	"os"
	"path/filepath"
)

const (
	repoPath = "path/to/repo"
)

type sfdxProject struct {
	PackageDirectories []packageDirectory `json:"packageDirectories"`
}

type packageDirectory struct {
	Path    string `json:"path"`
	Package string `json:"package"`
	Size    int    `json:"size"`
}

func main() {
	err := run(os.Stdout)
	if err != nil {
		log.Fatal(err)
	}
}

func run(w io.Writer) error {
	basepath := repoPath
	path := filepath.Join(basepath, "sfdx-project.json")
qq
	f, err := os.Open(path)
	if err != nil {
		return fmt.Errorf("could not open project file:  %s", err)
	}
	defer f.Close()

	var project sfdxProject
	if err = json.NewDecoder(f).Decode(&project); err != nil {
		return fmt.Errorf("could not parse project file: %s", err)
	}

	for i := range project.PackageDirectories {
		pack := &project.PackageDirectories[i]
		pack.Size = 0
		packageDir := filepath.Join(basepath, pack.Path)
		err := filepath.WalkDir(packageDir, func(path string, d fs.DirEntry, err error) error {
			pack.Size++
			return nil
		})
		if err != nil {
			return fmt.Errorf("could not compute dir size: %s", err)
		}
	}

	if _, err = fmt.Fprintf(w, "const dataJson = "); err != nil {
		return fmt.Errorf("could not write output: %s", err)
	}

	enc := json.NewEncoder(w)
	enc.SetIndent("", "    ")
	if err = enc.Encode(project.PackageDirectories); err != nil {
		return fmt.Errorf("could not serialize packages: %s", err)
	}

	if _, err = fmt.Fprintf(w, ";"); err != nil {
		return fmt.Errorf("could not write output: %s", err)
	}

	return nil
}
