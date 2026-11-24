import { createApp } from './app';
const port = Number(process.env.PORT || 3001);
const { http } = createApp();
http.listen(port, '0.0.0.0', () => console.log(`Game server: http://localhost:${port}`));
