package com.irctc.itsm.model;

public class ITService {
    private Long serviceId;
    private String serviceName;
    private String category;
    private SeverityLevel businessCriticality;

    public ITService() {}

    public ITService(Long serviceId, String serviceName, String category, SeverityLevel businessCriticality) {
        this.serviceId = serviceId;
        this.serviceName = serviceName;
        this.category = category;
        this.businessCriticality = businessCriticality;
    }

    public Long getServiceId() { return serviceId; }
    public void setServiceId(Long serviceId) { this.serviceId = serviceId; }

    public String getServiceName() { return serviceName; }
    public void setServiceName(String serviceName) { this.serviceName = serviceName; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public SeverityLevel getBusinessCriticality() { return businessCriticality; }
    public void setBusinessCriticality(SeverityLevel businessCriticality) { this.businessCriticality = businessCriticality; }
}