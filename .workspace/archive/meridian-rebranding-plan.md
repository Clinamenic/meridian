# Meridian Rebranding Plan: Cosmo → Meridian

## Executive Summary

**Objective**: Complete rebrand from "Cosmo" to "Meridian" across all touchpoints
**Timeline**: 4-6 weeks for full implementation
**Scope**: Codebase, workspace, documentation, legal, and brand identity
**Risk Level**: Moderate (trademark considerations acknowledged)

---

## Phase 1: Legal & Trademark Foundation (Week 1)

### 1.1 Trademark Research & Filing

**Priority Actions:**

- [ ] Conduct comprehensive trademark search in target markets
- [ ] File defensive trademark applications for "Meridian" in software/app classes
- [ ] Research domain availability and secure primary domains
- [ ] Engage IP attorney for trademark strategy consultation

**Deliverables:**

- Trademark search report
- Domain acquisition strategy
- Legal risk assessment document
- Filing timeline and costs

### 1.2 Domain Acquisition Strategy

**Primary Domains to Secure:**

- [ ] `meridianapp.com` (primary)
- [ ] `getmeridian.com` (alternative)
- [ ] `meridian.io` (tech-focused)
- [ ] `meridian.co` (startup-friendly)
- [ ] `meridianlocal.com` (differentiation)

**Social Media Handles:**

- [ ] @meridianapp (Twitter/X)
- [ ] @getmeridian (Instagram)
- [ ] /meridianapp (Facebook)
- [ ] /company/meridian-app (LinkedIn)

---

## Phase 2: Brand Identity Development (Week 2)

### 2.1 Visual Identity System

**Logo Design Requirements:**

- [ ] Primary logo incorporating meridian/navigation concepts
- [ ] Monogram version (M symbol)
- [ ] Horizontal and vertical layouts
- [ ] Light/dark theme variations
- [ ] Icon versions for app stores and favicons

**Color Palette Evolution:**

- [ ] Maintain current mint green theme (#4ffa9f) as primary
- [ ] Develop secondary colors inspired by navigation/geography
- [ ] Create accessibility-compliant color combinations
- [ ] Document color usage guidelines

**Typography:**

- [ ] Maintain Geist font family (already optimized)
- [ ] Define hierarchy for Meridian brand
- [ ] Create typography guidelines document

### 2.2 Brand Messaging Framework

**Core Messaging:**

- [ ] Develop brand positioning statement
- [ ] Create elevator pitch variations
- [ ] Define key differentiators from competitors
- [ ] Establish tone of voice guidelines

**Tagline Options:**

- [ ] "Navigate the intersection of local and global"
- [ ] "Your coordinates in the knowledge commons"
- [ ] "Where local action meets global wisdom"
- [ ] "Mapping the meridians of collaboration"

---

## Phase 3: Codebase Transformation (Week 3-4)

### 3.1 Application Naming Updates

**Core Application Files:**

- [ ] Update `package.json` name field: `"cosmo"` → `"meridian"`
- [ ] Update `package.json` description and keywords
- [ ] Modify application title in `src/main/main.ts`
- [ ] Update window title configurations
- [ ] Change app ID in Electron configuration

**File Structure Changes:**

```bash
# Current structure to maintain
src/
├── main/           # Keep structure
├── renderer/       # Keep structure
└── types/          # Keep structure

# No major restructuring needed
```

### 3.2 User Interface Updates

**Header/Title Updates:**

- [ ] Update `.app-title` in `src/renderer/styles.css`
- [ ] Modify header text from "COSMO" to "MERIDIAN"
- [ ] Update modal titles and headings
- [ ] Revise about/info modal content

**Branding Elements:**

- [ ] Replace any Cosmo references in UI text
- [ ] Update loading messages and status text
- [ ] Modify error messages and notifications
- [ ] Update footer branding elements

### 3.3 Configuration & Settings

**Application Configuration:**

- [ ] Update Electron app configuration
- [ ] Modify build configuration files
- [ ] Update application metadata
- [ ] Change app bundle identifier

**Data Storage:**

- [ ] Plan migration strategy for user data
- [ ] Update database/storage keys if needed
- [ ] Maintain backward compatibility during transition

---

## Phase 4: Workspace & Documentation (Week 4)

### 4.1 Workspace Rebranding

**Directory Structure:**

```bash
# Current: /Users/gideon/Hub/private/projects/Cosmo
# Future: /Users/gideon/Hub/private/projects/Meridian

# Migration approach:
1. Create new Meridian directory
2. Copy/move project files
3. Update all references
4. Archive old Cosmo directory
```

**Workspace Files:**

- [ ] Update `.cursor/` configuration files
- [ ] Modify workspace-specific documentation
- [ ] Update project README files
- [ ] Revise development documentation

### 4.2 Documentation Updates

**Core Documentation:**

- [ ] Update main README.md
- [ ] Revise feature documentation
- [ ] Modify installation instructions
- [ ] Update development setup guides

**API Documentation:**

- [ ] Update any API endpoint documentation
- [ ] Revise integration guides
- [ ] Modify SDK/library references

### 4.3 Repository Management

**Version Control:**

- [ ] Plan repository rename strategy
- [ ] Update remote repository references
- [ ] Modify CI/CD pipeline configurations
- [ ] Update deployment scripts

---

## Phase 5: Technical Implementation (Week 5)

### 5.1 Build System Updates

**Electron Configuration:**

```javascript
// Update electron-builder configuration
{
  "appId": "com.meridian.app",
  "productName": "Meridian",
  "directories": {
    "output": "dist"
  },
  "mac": {
    "category": "public.app-category.productivity"
  }
}
```

**Package.json Updates:**

```json
{
  "name": "meridian",
  "productName": "Meridian",
  "description": "Navigate the intersection of local and global knowledge",
  "keywords": ["meridian", "cosmolocal", "knowledge-management", "local-first"]
}
```

### 5.2 Asset Management

**Icon Updates:**

- [ ] Create new app icons in multiple sizes
- [ ] Update favicon files
- [ ] Replace loading screen graphics
- [ ] Modify splash screen elements

**Resource Files:**

- [ ] Update any embedded images with Cosmo branding
- [ ] Modify CSS background images if needed
- [ ] Replace any hardcoded brand references

### 5.3 Testing & Quality Assurance

**Testing Checklist:**

- [ ] Verify all UI text updates
- [ ] Test application startup and initialization
- [ ] Validate window titles and system integration
- [ ] Check build process and distribution
- [ ] Test data migration and compatibility

---

## Phase 6: External Integration Updates (Week 6)

### 6.1 Third-Party Service Updates

**Service Integrations:**

- [ ] Update Arweave metadata/tags if applicable
- [ ] Modify social media API integrations
- [ ] Update any external service registrations
- [ ] Revise webhook/callback URLs

### 6.2 Distribution Preparation

**App Store Preparation:**

- [ ] Prepare new app store listings
- [ ] Create updated screenshots and descriptions
- [ ] Plan app store submission strategy
- [ ] Prepare marketing materials

**Website/Landing Page:**

- [ ] Design new website for meridianapp.com
- [ ] Create product documentation site
- [ ] Set up analytics and tracking
- [ ] Implement redirect strategy from old URLs

---

## Implementation Timeline

### Week 1: Foundation

- **Days 1-2**: Legal research and domain acquisition
- **Days 3-5**: Trademark filing and IP strategy
- **Days 6-7**: Brand identity conceptualization

### Week 2: Design

- **Days 1-3**: Logo design and visual identity
- **Days 4-5**: Brand messaging and guidelines
- **Days 6-7**: Asset creation and documentation

### Week 3: Codebase (Part 1)

- **Days 1-3**: Core application naming updates
- **Days 4-5**: UI text and branding updates
- **Days 6-7**: Configuration and settings updates

### Week 4: Codebase (Part 2) & Documentation

- **Days 1-3**: Workspace migration and setup
- **Days 4-5**: Documentation updates
- **Days 6-7**: Repository management

### Week 5: Technical Implementation

- **Days 1-3**: Build system and packaging updates
- **Days 4-5**: Asset management and testing
- **Days 6-7**: Quality assurance and bug fixes

### Week 6: Launch Preparation

- **Days 1-3**: External integration updates
- **Days 4-5**: Distribution preparation
- **Days 6-7**: Final testing and launch readiness

---

## Risk Mitigation Strategies

### 6.1 Technical Risks

**Data Migration:**

- [ ] Create backup strategy for user data
- [ ] Implement rollback procedures
- [ ] Test migration scripts thoroughly
- [ ] Provide user migration guides

**Compatibility:**

- [ ] Maintain backward compatibility during transition
- [ ] Version control for gradual rollout
- [ ] Monitor for breaking changes
- [ ] Prepare hotfix procedures

### 6.2 Legal Risks

**Trademark Protection:**

- [ ] Monitor trademark opposition proceedings
- [ ] Prepare defensive strategies
- [ ] Document prior art and usage
- [ ] Maintain legal counsel availability

**Domain Security:**

- [ ] Secure all relevant domain variations
- [ ] Implement domain monitoring
- [ ] Set up trademark watch services
- [ ] Prepare domain defense strategies

### 6.3 Brand Transition Risks

**User Communication:**

- [ ] Develop transition communication strategy
- [ ] Create FAQ for rebrand questions
- [ ] Plan announcement timeline
- [ ] Prepare customer support materials

**Market Confusion:**

- [ ] Monitor brand mention tracking
- [ ] Prepare differentiation messaging
- [ ] Create comparison documentation
- [ ] Implement brand monitoring tools

---

## Success Metrics

### Technical Success Metrics

- [ ] Zero data loss during migration
- [ ] 100% feature parity maintained
- [ ] Build success rate: 100%
- [ ] User migration completion rate: >95%

### Brand Success Metrics

- [ ] Trademark application acceptance
- [ ] Domain acquisition completion: 100%
- [ ] Brand consistency score: >90%
- [ ] User recognition of new brand: >80%

### Business Success Metrics

- [ ] User retention during transition: >90%
- [ ] App store approval rate: 100%
- [ ] Legal compliance score: 100%
- [ ] Market differentiation effectiveness: Measurable

---

## Budget Considerations

### Legal & IP Costs

- **Trademark Filing**: $1,500 - $3,000
- **Legal Consultation**: $3,000 - $5,000
- **Domain Acquisition**: $500 - $2,000
- **IP Monitoring**: $500 - $1,000/year

### Design & Development

- **Logo/Brand Design**: $2,000 - $5,000
- **Development Time**: 80-120 hours
- **Testing & QA**: 20-40 hours
- **Documentation**: 20-30 hours

### Marketing & Launch

- **Website Development**: $3,000 - $8,000
- **Marketing Materials**: $1,000 - $3,000
- **App Store Assets**: $500 - $1,500
- **Launch Campaign**: $2,000 - $5,000

**Total Estimated Budget**: $14,000 - $33,500

---

## Post-Launch Monitoring

### 30-Day Post-Launch Checklist

- [ ] Monitor trademark opposition filings
- [ ] Track user adoption and feedback
- [ ] Analyze brand recognition metrics
- [ ] Review technical performance metrics
- [ ] Assess competitive response

### 90-Day Review

- [ ] Comprehensive brand audit
- [ ] User satisfaction survey
- [ ] Technical stability assessment
- [ ] Legal compliance review
- [ ] Market positioning analysis

---

## Conclusion

The Meridian rebrand represents a strategic evolution that aligns the application name with its sophisticated cosmolocal principles. While trademark considerations require careful navigation, the conceptual strength of "Meridian" as a brand provides significant long-term value.

**Key Success Factors:**

1. Thorough legal preparation and trademark strategy
2. Systematic technical implementation with zero data loss
3. Clear communication during brand transition
4. Strong differentiation from existing Meridian products
5. Consistent brand execution across all touchpoints

**Next Steps:**

1. Approve overall rebranding strategy
2. Begin legal/trademark research phase
3. Initiate domain acquisition process
4. Develop detailed implementation schedule
5. Assemble rebranding team and resources

---

**Document Status**: Draft for Review  
**Last Updated**: January 2025  
**Classification**: Strategic Planning Document
