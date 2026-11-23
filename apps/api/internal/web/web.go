package web

import (
	"embed"
	"io/fs"
	"net/http"
	"path"
	"strings"
)

//go:embed all:dist
var distFS embed.FS

//go:embed fallback.html
var fallback []byte

// Handler serves the built SPA from dist, falling back to a built-in page until
// the web app has been built into the binary.
func Handler() http.Handler {
	dist, err := fs.Sub(distFS, "dist")
	if err != nil {
		panic(err)
	}

	indexHTML, indexErr := fs.ReadFile(dist, "index.html")
	files := http.FileServer(http.FS(dist))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		name := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if name == "" {
			name = "index.html"
		}

		if info, statErr := fs.Stat(dist, name); statErr == nil && !info.IsDir() {
			w.Header().Set("Cache-Control", cacheControl(name))
			files.ServeHTTP(w, r)
			return
		}

		if indexErr == nil {
			writeHTML(w, indexHTML)
			return
		}

		writeHTML(w, fallback)
	})
}

func cacheControl(name string) string {
	if strings.HasPrefix(name, "assets/") {
		return "public, max-age=31536000, immutable"
	}
	return "no-cache"
}

func writeHTML(w http.ResponseWriter, body []byte) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	_, _ = w.Write(body)
}
