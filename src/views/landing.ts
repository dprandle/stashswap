export const landing_html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Destash Marketplace</title>
  <script src="https://unpkg.com/htmx.org@1.9.3"></script>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=Roboto:wght@400&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="styles.css">
</head>
<body>

  <!-- Navigation Bar -->
  <nav>
    <div class="nav-left">
      <img src="/logo.svg" alt="Logo" style="width:32px;height:32px;">
      <a href="/">Home</a>
    </div>

    <div class="nav-center">
      <input type="text" class="search" placeholder="Search yarns...">
    </div>

    <div class="nav-right">
      <button class="sign-in">Sign In</button>
      <a href="/cart" class="button cart">Cart</a>
    </div>
  </nav>

  <!-- Landing Page -->
  <main>
    <h1>Products</h1>
  </main>

</body>
</html>`;
