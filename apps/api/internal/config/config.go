package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port int
}

func Load() Config {
	port := 8080
	if raw := os.Getenv("PORT"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil {
			port = parsed
		}
	}

	return Config{Port: port}
}
