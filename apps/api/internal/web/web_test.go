package web

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func serve(method, target string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, target, nil)
	response := httptest.NewRecorder()
	Handler().ServeHTTP(response, request)
	return response
}

func TestServesHTMLForClientRoutes(t *testing.T) {
	response := serve(http.MethodGet, "/lesson/pods-101")

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, response.Code)
	}

	if contentType := response.Header().Get("Content-Type"); !strings.HasPrefix(contentType, "text/html") {
		t.Fatalf("expected HTML content type, got %q", contentType)
	}
}

func TestRejectsNonReadMethods(t *testing.T) {
	response := serve(http.MethodPost, "/")

	if response.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected status %d, got %d", http.StatusMethodNotAllowed, response.Code)
	}
}
