# Deploy to nyxen.centralindia.cloudapp.azure.com/project

1. In Microsoft Entra app registration for the frontend SPA, add this redirect URI:

   https://nyxen.centralindia.cloudapp.azure.com/project/

2. On the VM, run the app container on localhost port 8080 using Docker Compose.

3. Add `deploy/nginx/vps-project-location.conf` inside the existing HTTPS `server { ... }` block for `nyxen.centralindia.cloudapp.azure.com`.

4. Test and reload Nginx:

   sudo nginx -t
   sudo systemctl reload nginx

5. Verify:

   https://nyxen.centralindia.cloudapp.azure.com/project/
   https://nyxen.centralindia.cloudapp.azure.com/project/api/health
