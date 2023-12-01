package main

import (
	"embed"
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"io/fs"
)

var (
	//go:embed templates/*
	files     embed.FS
	indexTmpl *template.Template = template.Must(template.ParseFS(files, "templates/index.gohtml"))
)

func render(out io.Writer, data interface{}) error {
	vizjs, err := fs.ReadFile(files, "templates/viz.js")
	if err != nil {
		panic(err)
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("could not convert data to json: %w", err)
	}

	templData := struct {
		Viz  template.JS
		Data template.JS
	}{
		Viz:  template.JS(string(vizjs)),
		Data: template.JS(string(jsonData)),
	}

	return indexTmpl.Execute(out, templData)
}
