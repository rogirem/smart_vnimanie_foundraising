-- SQL скрипт для создания базы данных фонда "Внимание"
-- Выполните этот скрипт в MySQL для создания базы данных и таблиц

-- Создание базы данных (если еще не создана)
CREATE DATABASE IF NOT EXISTS fondvnimanie CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Использование базы данных
USE fondvnimanie;

-- Таблица доноров
CREATE TABLE IF NOT EXISTS donors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    address VARCHAR(42) UNIQUE NOT NULL COMMENT 'Адрес кошелька Ethereum',
    first_name VARCHAR(100) COMMENT 'Имя донора',
    last_name VARCHAR(100) COMMENT 'Фамилия донора',
    is_anonymous BOOLEAN DEFAULT false COMMENT 'Анонимное пожертвование',
    total_amount DECIMAL(30, 10) DEFAULT 0 COMMENT 'Общая сумма пожертвований',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Дата создания записи',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Дата обновления записи',
    INDEX idx_address (address),
    INDEX idx_total_amount (total_amount DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Таблица проектов
CREATE TABLE IF NOT EXISTS projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT UNIQUE NOT NULL COMMENT 'ID проекта в смарт-контракте',
    name VARCHAR(255) NOT NULL COMMENT 'Название проекта',
    description TEXT COMMENT 'Описание проекта',
    target_amount DECIMAL(30, 10) NOT NULL COMMENT 'Целевая сумма (в ETH)',
    image_url VARCHAR(500) COMMENT 'URL изображения проекта',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Дата создания проекта',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Дата обновления проекта',
    INDEX idx_project_id (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Таблица пожертвований
CREATE TABLE IF NOT EXISTS donations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    donor_address VARCHAR(42) NOT NULL COMMENT 'Адрес донора',
    project_id INT NOT NULL COMMENT 'ID проекта',
    amount DECIMAL(30, 10) NOT NULL COMMENT 'Сумма пожертвования (в ETH)',
    transaction_hash VARCHAR(66) COMMENT 'Хеш транзакции в блокчейне',
    timestamp BIGINT NOT NULL COMMENT 'Временная метка пожертвования',
    is_anonymous BOOLEAN DEFAULT false COMMENT 'Анонимное пожертвование',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Дата создания записи',
    INDEX idx_donor (donor_address),
    INDEX idx_project (project_id),
    INDEX idx_timestamp (timestamp DESC),
    INDEX idx_transaction_hash (transaction_hash),
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Примеры проектов (для тестирования)
-- Эти данные будут синхронизированы со смарт-контрактом
-- В реальном приложении проекты создаются через смарт-контракт и затем добавляются в БД

-- Для тестирования можно добавить тестовые проекты после развертывания контракта
-- INSERT INTO projects (project_id, name, description, target_amount, image_url) VALUES
-- (1, 'Реставрация исторического фасада', 'Восстановление фасада здания XIX века в центре города', 10.0, NULL),
-- (2, 'Восстановление балконов', 'Реставрация исторических балконов на памятнике архитектуры', 5.0, NULL);


