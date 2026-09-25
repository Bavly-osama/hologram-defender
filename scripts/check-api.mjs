for (const path of ["/api/health", "/api/leaderboard?limit=1", "/"]) {
  const response = await fetch(`http://localhost:3001${path}`);
  console.log(
    path,
    response.status,
    response.headers.get("content-security-policy") ? "CSP present" : "no CSP",
  );
  if (!response.ok) process.exitCode = 1;
}
