<?php
// Загрузите этот файл в htdocs на InfinityFree.
// Замените URL на ваш адрес с Render после деплоя.
$site = 'https://ВАШ-САЙТ.onrender.com';
header('Location: ' . $site, true, 302);
exit;
