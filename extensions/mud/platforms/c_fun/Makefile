CC ?= cc
CFLAGS ?= -O2 -std=c11 -Wall -Wextra
LDFLAGS ?= -lm

all: tunneling_grid

tunneling_grid: tunneling_grid.c
	$(CC) $(CFLAGS) -o tunneling_grid tunneling_grid.c $(LDFLAGS)

clean:
	rm -f tunneling_grid

.PHONY: all clean
