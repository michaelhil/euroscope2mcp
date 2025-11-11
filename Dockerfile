FROM node:18-alpine

# Install tshark
RUN apk add --no-cache tshark libcap

# Set capabilities for tshark to capture packets without root
RUN setcap cap_net_raw,cap_net_admin=eip /usr/bin/dumpcap

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (none currently, but good practice)
RUN npm ci --only=production || true

# Copy application code
COPY src/ ./src/
COPY examples/ ./examples/

# Create non-root user
RUN addgroup -g 1001 appuser && \
    adduser -D -u 1001 -G appuser appuser && \
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Default command
CMD ["node", "examples/basic-usage.js"]
