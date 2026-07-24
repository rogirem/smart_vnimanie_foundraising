// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract DonationContract {
    address public owner;
    
    struct Project {
        uint256 id;
        string name;
        uint256 targetAmount;
        uint256 collectedAmount;
        bool isActive;
        address projectWallet;
    }
    
    struct Donation {
        address donor;
        uint256 projectId;
        uint256 amount;
        uint256 timestamp;
        bool isAnonymous;
    }
    
    mapping(uint256 => Project) public projects;
    mapping(uint256 => Donation) public donations;
    
    uint256 public donationCount;
    uint256 public projectCount;
    mapping(address => uint256) public donorTotalAmount;
    
    event ProjectCreated(uint256 indexed projectId, string name, uint256 targetAmount);
    event DonationReceived(address indexed donor, uint256 indexed projectId, uint256 amount, uint256 timestamp);
    event FundsWithdrawn(uint256 indexed projectId, uint256 amount);
    event ProjectStatusChanged(uint256 indexed projectId, bool isActive);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    function createProject(string memory _name, uint256 _targetAmount, address _projectWallet) public onlyOwner {
        projectCount++;
        projects[projectCount] = Project({
            id: projectCount,
            name: _name,
            targetAmount: _targetAmount,
            collectedAmount: 0,
            isActive: true,
            projectWallet: _projectWallet
        });
        emit ProjectCreated(projectCount, _name, _targetAmount);
    }
    
    function donate(uint256 _projectId, bool _isAnonymous) public payable {
        require(_projectId > 0 && _projectId <= projectCount, "Project does not exist");
        require(projects[_projectId].isActive, "Project is not active");
        require(msg.value > 0, "Donation amount must be greater than 0");
        
        projects[_projectId].collectedAmount += msg.value;
        donorTotalAmount[msg.sender] += msg.value;
        
        donationCount++;
        donations[donationCount] = Donation({
            donor: msg.sender,
            projectId: _projectId,
            amount: msg.value,
            timestamp: block.timestamp,
            isAnonymous: _isAnonymous
        });
        
        emit DonationReceived(msg.sender, _projectId, msg.value, block.timestamp);
    }
    
    function getProject(uint256 _projectId) public view returns (
        uint256 id,
        string memory name,
        uint256 targetAmount,
        uint256 collectedAmount,
        bool isActive,
        address projectWallet
    ) {
        require(_projectId > 0 && _projectId <= projectCount, "Project does not exist");
        Project memory project = projects[_projectId];
        return (project.id, project.name, project.targetAmount, project.collectedAmount, project.isActive, project.projectWallet);
    }
    
    function getDonation(uint256 _donationId) public view returns (
        address donor,
        uint256 projectId,
        uint256 amount,
        uint256 timestamp,
        bool isAnonymous
    ) {
        require(_donationId > 0 && _donationId <= donationCount, "Donation does not exist");
        Donation memory donation = donations[_donationId];
        return (donation.donor, donation.projectId, donation.amount, donation.timestamp, donation.isAnonymous);
    }
    
    function withdrawFunds(uint256 _projectId, uint256 _amount) public onlyOwner {
        require(_projectId > 0 && _projectId <= projectCount, "Project does not exist");
        require(_amount > 0, "Amount must be greater than 0");
        require(projects[_projectId].collectedAmount >= _amount, "Insufficient funds");
        
        address projectWallet = projects[_projectId].projectWallet;
        require(projectWallet != address(0), "Project wallet not set");
        
        projects[_projectId].collectedAmount -= _amount;
        (bool success, ) = projectWallet.call{value: _amount}("");
        require(success, "Transfer failed");
        
        emit FundsWithdrawn(_projectId, _amount);
    }
    
    function setProjectStatus(uint256 _projectId, bool _isActive) public onlyOwner {
        require(_projectId > 0 && _projectId <= projectCount, "Project does not exist");
        projects[_projectId].isActive = _isActive;
        emit ProjectStatusChanged(_projectId, _isActive);
    }
    
    function getContractBalance() public view returns (uint256) {
        return address(this).balance;
    }
    
    function getProjectProgress(uint256 _projectId) public view returns (uint256) {
        require(_projectId > 0 && _projectId <= projectCount, "Project does not exist");
        Project memory project = projects[_projectId];
        if (project.targetAmount == 0) {
            return 0;
        }
        return (project.collectedAmount * 100) / project.targetAmount;
    }
}
