package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"strings"
	"time"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing/object"
)

const (
	repoPath = "/Users/rodolphe.blancho/workspaces/seek/sfdc-core"
	usage    = `Usage:
    flxblviz [--repository REPO] [--output OUTPUT] [--domains DOMAINS]
Options
    -r, --repository REPO  Path to the git repository containing the project
    -o, --output OUTPUT    Path to the outputfile
    -d, --domains DOMAINS  Path to the domains.json file
    --help                 Display this message

REPO defaults to the current directory, and OUTPUT defaults to standard output.
If OUTPUT exists, it will be overwritten.

DOMAINS is the path to a json file containing mapping between the packages
and their domain. The json file must contain only one object whose keys are the
package names and a string value representing the domain name.

    {
        "my-package": "domain1",
        "another-package": "my-other-domain"
    }

Example:
    $ flxblviz -o index.html
    $ flxblvix -r path/to/repo`
)

type sfdxProject struct {
	PackageDirectories []packageDirectory `json:"packageDirectories"`
}

type packageDirectory struct {
	Path      string    `json:"path"`
	Package   string    `json:"package"`
	Size      int       `json:"size"`
	Domain    string    `json:"domain"`
	When      time.Time `json:"when"`
	FileCount int       `json:"fileCount"`
}

func main() {
	var (
		repositoryFlag string
		outputFlag     string
		domainsFlag    string
		helpFlag       bool
	)

	flag.Usage = func() { fmt.Fprintf(os.Stderr, "%s\n", usage) }
	flag.StringVar(&repositoryFlag, "repository", "", "Path to the git repository")
	flag.StringVar(&repositoryFlag, "r", "", "Path to the git repository")
	flag.StringVar(&outputFlag, "output", "", "output filename")
	flag.StringVar(&outputFlag, "o", "", "output filename")
	flag.StringVar(&domainsFlag, "domains", "", "domains filename")
	flag.StringVar(&domainsFlag, "d", "", "domains filename")
	flag.BoolVar(&helpFlag, "help", false, "Print help message")
	flag.Parse()

	if helpFlag {
		flag.Usage()
		return
	}

	repository := repositoryFlag
	if repository == "" {
		cwd, err := os.Getwd()
		if err != nil {
			errorf("could not get the current working directory: %s", err)
			os.Exit(1)
		}
		repository = cwd
	}

	var domains map[string]string
	if domainsFlag == "" {
		domains = make(map[string]string)
	} else {
		data, err := loadDomains(domainsFlag)
		if err != nil {
			errorf("could not read the domains file: %s", err)
			os.Exit(1)
		}
		domains = data
	}

	var out io.Writer
	if outputFlag == "" {
		out = os.Stdout
	} else {
		f, err := os.Create(outputFlag)
		if err != nil {
			errorf("could not open output file: %s", err)
			os.Exit(1)
		}
		defer f.Close()
		out = f
	}

	if err := run(repository, domains, out); err != nil {
		log.Fatalf("%s", err)
	}
}

func errorf(format string, v ...interface{}) {
	fmt.Fprintf(os.Stderr, "flxblviz: "+format, v)
}

func run(repoPath string, domains map[string]string, out io.Writer) error {
	iter, err := getLogIterator(repoPath)
	if err != nil {
		return err
	}
	defer iter.Close()

	var pp [][]packageDirectory

	index := 0

	for {
		commit, err := iter.Next()
		if err != nil {
			break
		}

		pDirs, err := getInfo(commit)
		if err != nil {
			continue
		}

		files, err := getFilesInCommit(commit)
		if err != nil {
			continue
		}

		for i := range pDirs {
			if pDirs[i].Package == "" {
				pDirs[i].Package = pDirs[i].Path
			}

			pDirs[i].Size = len(pDirs[i].Package)
			pDirs[i].Domain = domains[pDirs[i].Package]
			pDirs[i].When = commit.Author.When
			pDirs[i].FileCount = countFilesInPath(files, pDirs[i].Path)
		}

		pp = append(pp, pDirs)

		index++
	}

	fmt.Fprint(out, "const dataJson = ")
	return json.NewEncoder(out).Encode(pp)
}

func loadDomains(path string) (map[string]string, error) {
	var domains map[string]string

	f, err := os.Open(path)
	if err != nil {
		return domains, err
	}
	defer f.Close()

	err = json.NewDecoder(f).Decode(&domains)

	return domains, err
}

func getFilesInCommit(c *object.Commit) ([]string, error) {
	var files []string

	fileIter, err := c.Files()
	if err != nil {
		return files, err
	}
	defer fileIter.Close()

	err = fileIter.ForEach(func(f *object.File) error {
		files = append(files, f.Name)
		return nil
	})

	return files, err
}

func countFilesInPath(files []string, path string) int {
	count := 0

	for _, fname := range files {
		if strings.HasPrefix(fname, path) {
			count++
		}
	}

	return count
}

func parseSfdxProjectJSON(f *object.File) ([]packageDirectory, error) {
	r, err := f.Reader()
	if err != nil {
		return nil, fmt.Errorf("could not open file: %s", err)
	}

	var p sfdxProject
	if err := json.NewDecoder(r).Decode(&p); err != nil {
		return nil, err
	}

	return p.PackageDirectories, nil
}

func getLogIterator(dir string) (object.CommitIter, error) {
	repo, err := git.PlainOpen(dir)
	if err != nil {
		return nil, fmt.Errorf("could not open git repo: %s", err)
	}

	ref, err := repo.Head()
	if err != nil {
		return nil, fmt.Errorf("could not get HEAD ref: %s", err)
	}

	fname := "sfdx-project.json"

	iter, err := repo.Log(&git.LogOptions{
		From:     ref.Hash(),
		Order:    git.LogOrderCommitterTime,
		FileName: &fname,
	})
	if err != nil {
		return nil, fmt.Errorf("could not get log iterator: %s", err)
	}

	return iter, nil
}

func getInfo(c *object.Commit) ([]packageDirectory, error) {
	t, err := c.Tree()
	if err != nil {
		return nil, fmt.Errorf("could not get tree of commit: %s", err)
	}

	f, err := t.File("sfdx-project.json")
	if err != nil {
		return nil, err
	}

	return parseSfdxProjectJSON(f)
}
