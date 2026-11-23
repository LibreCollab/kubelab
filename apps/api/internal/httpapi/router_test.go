package httpapi

import (
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
)

func newTestHandler() http.Handler {
	return New(slog.New(slog.DiscardHandler), http.NotFoundHandler())
}

func serve(method, target string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, target, nil)
	response := httptest.NewRecorder()
	newTestHandler().ServeHTTP(response, request)
	return response
}

func TestHealthz(t *testing.T) {
	response := serve(http.MethodGet, "/api/healthz")

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, response.Code)
	}

	if contentType := response.Header().Get("Content-Type"); contentType != "application/json; charset=utf-8" {
		t.Fatalf("unexpected content type %q", contentType)
	}

	if nosniff := response.Header().Get("X-Content-Type-Options"); nosniff != "nosniff" {
		t.Fatalf("expected nosniff header, got %q", nosniff)
	}
}

func TestMeRequiresAuth(t *testing.T) {
	response := serve(http.MethodGet, "/api/me")

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", http.StatusUnauthorized, response.Code)
	}
}

func TestUnknownAPIPathReturnsJSON(t *testing.T) {
	response := serve(http.MethodGet, "/api/nope")

	if response.Code != http.StatusNotFound {
		t.Fatalf("expected status %d, got %d", http.StatusNotFound, response.Code)
	}

	if contentType := response.Header().Get("Content-Type"); contentType != "application/json; charset=utf-8" {
		t.Fatalf("unexpected content type %q", contentType)
	}
}

func TestAPIMethodNotAllowed(t *testing.T) {
	response := serve(http.MethodPost, "/api/healthz")

	if response.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected status %d, got %d", http.StatusMethodNotAllowed, response.Code)
	}
}
