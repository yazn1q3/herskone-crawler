# Herskone Crawler

Herskone Crawler is a smart web crawler that respects `robots.txt` rules, crawls websites, collects URLs, images, and metadata, and sends real-time logs and site info to a monitoring dashboard.

---

## Features

- Respects robots.txt rules  
- Crawls pages and extracts titles, descriptions, and images  
- Stores crawled data in JSON files  
- Real-time logging via WebSocket  
- Simple monitoring web interface to view logs and visited sites

---

## Getting Started

### Prerequisites

- Node.js installed (version 14 or higher recommended)  
- Internet connection

### Installation

```bash
npm install
```
To view the live logs and visited sites dashboard, run:

```bash
node web.js
```

Usage
To start crawling websites, run:

```bash
node crawler.js
```
and web on http://localhost:3000
