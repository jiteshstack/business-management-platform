// A small dedicated VPC for the database rather than the account's default
// VPC, so this stack owns its own networking and `terraform destroy` leaves
// nothing behind.
//
// The subnets are public because Amplify Hosting's SSR compute runs outside
// any customer VPC and therefore cannot reach a private-subnet database.
// The database is protected by TLS + a generated password + a security group
// that opens only 5432, not by network isolation - see rds.tf.

data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "${var.project_name}-${var.environment}-vpc" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = { Name = "${var.project_name}-${var.environment}-igw" }
}

# RDS requires a subnet group spanning at least two availability zones.
resource "aws_subnet" "public" {
  count = 2

  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = { Name = "${var.project_name}-${var.environment}-public-${count.index}" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = { Name = "${var.project_name}-${var.environment}-public-rt" }
}

resource "aws_route_table_association" "public" {
  count = length(aws_subnet.public)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-${var.environment}-db-subnets"
  subnet_ids = aws_subnet.public[*].id

  tags = { Name = "${var.project_name}-${var.environment}-db-subnets" }
}

resource "aws_security_group" "database" {
  name        = "${var.project_name}-${var.environment}-db-sg"
  description = "Postgres access for the application"
  vpc_id      = aws_vpc.main.id

  tags = { Name = "${var.project_name}-${var.environment}-db-sg" }
}

# Amplify's SSR compute has no fixed egress IP range to allow-list, so this
# cannot be narrowed to a CIDR without moving the app into the VPC (ECS).
# Everything else about the database is locked down to compensate: TLS is
# enforced, the password is long/random/generated, and no other port is open.
resource "aws_vpc_security_group_ingress_rule" "database_postgres" {
  security_group_id = aws_security_group.database.id
  description       = "Postgres from the application"

  cidr_ipv4   = "0.0.0.0/0"
  from_port   = 5432
  to_port     = 5432
  ip_protocol = "tcp"
}
